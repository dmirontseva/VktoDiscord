import { MessageEmbed, MessageAttachment } from 'discord.js';
import { hyperlink } from '@discordjs/builders';
import { AttachmentType, ISharedAttachmentPayload, AttachmentTypeString } from 'vk-io';

import { Message } from './Message';
import { ICluster } from './Handler';

import { generateRandomString, LINK_PREFIX } from '../utils';

const TEXTLIVE = 'textlive';
const PODCAST = 'podcast';

export type AttachmentTypeUnion = AttachmentTypeString | typeof TEXTLIVE | typeof PODCAST;

export type Attachment = {
    type: AttachmentTypeUnion;
} & {
    [key in AttachmentTypeUnion]: any;
};

const { AUDIO, DOCUMENT, LINK, PHOTO, POLL, VIDEO, ALBUM, MARKET, MARKET_ALBUM } = AttachmentType;

const TWITTER_URL = 'https://twitter.com';
const MAX_FIELD_LENGTH = 1024;
const ATTACHMENT_FIELD_SAFE_CONTENT_LENGTH = MAX_FIELD_LENGTH - 5;

// noinspection JSMethodCanBeStatic
export class Attachments {

    private readonly cluster: ICluster;

    constructor(cluster: Attachments['cluster']) {
        this.cluster = cluster;
    }

    parse(attachments: Attachment[], embeds: Message['embeds'], files: Message['files']): string[] {
        const { discord: { exclude_content } } = this.cluster;
        const [embed] = embeds;

        return attachments
            .reduce<string[]>((parsedAttachments, {
                type,
                photo,
                video,
                link,
                doc,
                audio,
                poll,
                album,
                textlive,
                market,
                podcast
            }) => {
                if (exclude_content.includes(type)) {
                    return parsedAttachments;
                }

                switch (type) {
                    case PHOTO: {
                        const { sizes } = photo;

                        if (sizes) {
                            if (!embed.image) {
                                embed.setImage(this.#popAttachment(sizes))
                                    .setURL(TWITTER_URL);
                            } else {
                                embeds.push(
                                    this.#createImageEmbed(this.#popAttachment(sizes))
                                );
                            }
                        }
                        break;
                    }
                    case VIDEO: {
                        let { owner_id, id, title, live, type, main_artists } = video;

                        const prefix = type === 'music_video' ?
                            '???? ????????'
                            :
                            live ?
                                '???? ????????????????????'
                                :
                                '???? ??????????';

                        if (main_artists?.length) {
                            const [{ name }] = main_artists;

                            title += ` - ${name}`;
                        }

                        parsedAttachments.push(
                            hyperlink(
                                `${prefix}: ${title}`,
                                `${LINK_PREFIX}${this.#generateAttachmentContext(video)}?z=${VIDEO}${owner_id}_${id}`
                            )
                        );
                        break;
                    }
                    case LINK: {
                        const { button_text = '????????????', title, url } = link;

                        parsedAttachments.push(
                            hyperlink(`???? ${button_text}: ${title}`, url)
                        );
                        break;
                    }
                    case DOCUMENT: {
                        const { ext, url, title } = doc;

                        if (ext === 'gif') {
                            const filename = `${generateRandomString(6)}.${ext}`;

                            if (!embed.image) {
                                files.push(
                                    new MessageAttachment(url, filename)
                                );

                                embed.setImage(`attachment://${filename}`)
                                    .setURL(TWITTER_URL);
                            } else if (embeds.length < 10) {
                                files.push(
                                    new MessageAttachment(url, filename)
                                );

                                embeds.push(
                                    this.#createImageEmbed(`attachment://${filename}`)
                                );
                            }
                        } else {
                            parsedAttachments.push(
                                hyperlink(`???? ????????: ${title}`, url)
                            );
                        }
                        break;
                    }
                    case AUDIO:
                    case PODCAST: {
                        const { owner_id, id, artist, title } = audio || podcast;

                        const prefix = audio ?
                            '???? ??????????????????????'
                            :
                            '??????? ??????????????';

                        parsedAttachments.push(
                            hyperlink(
                                `${prefix}: ${artist} - ${title}`,
                                `${LINK_PREFIX}${type}${owner_id}_${id}`
                            )
                        );
                        break;
                    }
                    case POLL: {
                        const { owner_id, id, question } = poll;

                        parsedAttachments.push(
                            hyperlink(
                                `???? ??????????: ${question}`,
                                `${LINK_PREFIX}${this.#generateAttachmentContext(poll)}?w=${type}${owner_id}_${id}`
                            )
                        );
                        break;
                    }
                    case ALBUM: {
                        const { owner_id, id, title } = album;

                        parsedAttachments.push(
                            hyperlink(
                                `??????? ????????????: ${title}`,
                                `${LINK_PREFIX}${type}${owner_id}_${id}`
                            )
                        );
                        break;
                    }
                    case MARKET: {
                        const { owner_id, id, title } = market;

                        parsedAttachments.push(
                            hyperlink(
                                `??????? ??????????: ${title}`,
                                `${LINK_PREFIX}${type}${owner_id}?w=product${owner_id}_${id}`
                            )
                        );
                        break;
                    }
                    case MARKET_ALBUM: {
                        const { owner_id, id, title } = market;

                        parsedAttachments.push(
                            hyperlink(
                                `??????? ???????????????? ??????????????: ${title}`,
                                `${LINK_PREFIX}${type}${owner_id}?section=${ALBUM}_${id}`
                            )
                        );
                        break;
                    }
                    case TEXTLIVE: {
                        const { textlive_id, title } = textlive;

                        parsedAttachments.push(
                            hyperlink(
                                `???? ????????????????: ${title}`,
                                `${LINK_PREFIX}${type}${textlive_id}`
                            )
                        );
                        break;
                    }
                }

                return parsedAttachments;
            }, [])
            .sort((a, b) => a.localeCompare(b))
            .reduce<string[]>((attachments, attachment, index) => {
                const field = attachments.at(-1);

                if ((field + attachment).length < MAX_FIELD_LENGTH && index) {
                    attachments[attachments.length - 1] += `\n${attachment}`;
                } else {
                    attachments.push(
                        this.#sliceAttachmentTitle(attachment)
                    );
                }

                return attachments;
            }, []);
    }

    #popAttachment(attachment: any[]): string {
        return attachment
            .sort((a, b) => a.width * a.height - b.width * b.height)
            .pop()
            .url;
    }

    #createImageEmbed(image_url: string): MessageEmbed {
        return new MessageEmbed()
            .setURL(TWITTER_URL)
            .setImage(image_url);
    }

    #generateAttachmentContext({ owner_id }: ISharedAttachmentPayload): string {
        const isUser = owner_id > 0;

        return `${isUser ? 'id' : 'feed'}${isUser ? Math.abs(owner_id) : ''}`;
    }

    #sliceAttachmentTitle(attachment: string): string {
        if (attachment.length > MAX_FIELD_LENGTH) {
            const isAttachment = attachment.match(/\[([^]+)]\(([^]+)\)/);

            if (isAttachment) {
                const [, title, url] = isAttachment;

                const availableLength = ATTACHMENT_FIELD_SAFE_CONTENT_LENGTH - url.length;

                if (title.length > availableLength) {
                    return hyperlink(`${title.slice(0, availableLength)}???`, url);
                }
            }
        }

        return attachment;
    }
}
