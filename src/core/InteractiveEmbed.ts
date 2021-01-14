import { DMChannel, Message, MessageEmbed, MessageEmbedOptions, NewsChannel, ReactionCollector, TextChannel, User } from 'discord.js';
import { EventEmitter } from 'events';

/** A MessageEmbed interactive using message reactions */
export default class InteractiveEmbed extends EventEmitter {
	/** The ReactionCollector bound to the embed message */
	public collector?: ReactionCollector;
	/** The embed */
	public embed: MessageEmbed;
	/** The emojis to interact */
	private emojis: string[];
	/** The embed data to change when the interactibility stops */
	private killed?: MessageEmbedOptions;
	/**
	 * @param emojis The emojis to interact
	 * @param embed The embed
	 * @param killed The embed data to change when the interactibility stops
	 */
	constructor(emojis: string[], embed: MessageEmbed | MessageEmbedOptions, killed?: MessageEmbedOptions) {
		super();
		this.emojis = emojis;
		this.embed = new MessageEmbed(embed);
		this.killed = killed;
	}

	/**
	 * Sends an interactive embed
	 * @param channel The channel where the embed is sent
	 * @param user The user able to interact with the embed
	 */
	public async send(channel: TextChannel | NewsChannel | DMChannel, user: User): Promise<InteractiveEmbed> {
		const message: Message = await channel.send(this.embed);
		this.emojis.forEach(async emoji => await message.react(emoji));
		this.collector = message.createReactionCollector((_reaction, u) => u.id === user.id, { idle: 60000, time: 180000 });
		this.collector.on('collect', async (reaction, user) => {
			await reaction.users.remove(user);
			if (this.emojis.includes(reaction.emoji.name))
				this.emit(reaction.emoji.name, reaction, user);
		});
		this.collector.on('end', () => {
			message.reactions.removeAll();
			if (this.killed) {
				const data = { ...this.embed.toJSON(), ...this.killed };
				this.embed = new MessageEmbed(data);
				message.edit(this.embed);
			}
		});
		return this;
	}
}

/** Multiple MessageEmbeds paginated into one */
export class PaginatedEmbed extends EventEmitter {
	/** The ReactionCollector bound to the embed message */
	public collector?: ReactionCollector;
	/** The embeds to paginate */
	public embeds: MessageEmbed[];
	/** The embed data to change when the interactibility stops */
	private killed?: MessageEmbedOptions;
	/**
	 * @param embeds An array containing the embeds to paginate
	 * @param killed The embed data to change when the interactibility stops
	 */
	constructor(embeds: MessageEmbed[], killed?: MessageEmbedOptions) {
		super();
		if (embeds.length == 0)
			throw new Error('At least 1 MessageEmbed must be provided in a PaginatedEmbed.');
		this.embeds = embeds.map((embed, i) => {
			if (embed.footer)
				embed.footer.text = (embed.footer.text || '') + ` • Page ${i + 1}/${embeds.length}`;
			else
				embed.setFooter(`Page ${i + 1}/${embeds.length}`);
			return embed;
		});
		this.killed = killed;
	}

	/**
	 * Sends the paginated embeds
	 * @param channel The channel where the embed is sent
	 * @param user The user able to interact with the embeds
	 */
	public async send(channel: TextChannel | NewsChannel | DMChannel, user: User): Promise<PaginatedEmbed> {
		const message: Message = await channel.send(this.embeds[0]);
		await message.react('⬅');
		await message.react('➡');
		let index = 0;
		const max: number = this.embeds.length - 1;
		this.collector = message.createReactionCollector((_reaction, u) => u.id === user.id, { idle: 60000, time: 180000 });
		this.collector.on('collect', async reaction => {
			await reaction.users.remove(user);
			if (reaction.emoji.name === '⬅')
				index = (index - 1 < 0) ? max : index - 1;
			else if (reaction.emoji.name === '➡')
				index = (index + 1 > max) ? 0 : index + 1;
			await message.edit(this.embeds[index]);
		});
		this.collector.on('end', () => {
			message.reactions.removeAll();
			if (this.killed) {
				const data = { ...this.embeds[index].toJSON(), ...this.killed };
				message.edit(new MessageEmbed(data));
			}
		});
		return this;
	}
}