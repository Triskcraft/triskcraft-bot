import { client } from '#/client.ts'
import { envs, STATE_KEYS } from '#/config.ts'
import { db } from '#/db.ts'
import { logger } from '#/logger.ts'
import {
    ActionRowBuilder,
    ButtonBuilder,
    ComponentType,
    ContainerBuilder,
    Events,
    GuildMember,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    Message,
    MessageFlags,
    Role,
    SeparatorBuilder,
    TextDisplayBuilder,
    ThreadAutoArchiveDuration,
    User,
    type SendableChannels,
} from 'discord.js'
import blogCreate from '#/interactions/buttons/blog/blog-create.ts'
import { PostsManager } from '#/classes/posts-manager.ts'
import { POST_STATUS } from '@triskcraft/db'
import type { Post } from '#/classes/post.ts'
import blogState from '#/interactions/buttons/blog/blog-post.ts'
import blogTitle from '#/interactions/buttons/blog/blog-title.ts'
import { BUCKETS, ensureBucket } from '#/s3.ts'
import blogCover from '#/interactions/buttons/blog/blog-cover.ts'

const PANEL_NAME = '# 📰 **Panel de Publicaciones**'

class BlogService {
    #message: Message | null = null
    #role: Role | null = null
    #channel: SendableChannels | null = null

    get role() {
        return this.#role
    }

    get channel() {
        return this.#channel
    }

    #posts = new PostsManager()

    get posts() {
        return this.#posts
    }

    async start() {
        logger.info('[BLOG SERVICE] Inicializando...')
        await this.#checkRole()
        if (!this.#role) return
        await this.#checkChannel()
        if (!this.#channel) return
        await ensureBucket(BUCKETS.BLOG)
        await this.#posts.fetch()
        await this.#renderPanel()
        await this.#installEventListener()
    }

    async #checkRole() {
        this.#role =
            (await client.guilds.cache
                .get(envs.DISCORD_GUILD_ID)
                ?.roles.fetch(envs.BLOG_ROLE_ID)
                .catch(() => null)) ?? null
        if (!this.#role) {
            logger.error(
                `[BLOG SERVICE] El rol ${envs.BLOG_ROLE_ID} no se encuentra disponible, se omitirá la inicialización`,
            )
        }
    }

    async #checkChannel() {
        const channel =
            client.channels.cache.get(envs.BLOG_CHANNEL_ID) ??
            (await client.channels.fetch(envs.BLOG_CHANNEL_ID))
        if (!channel) {
            return logger.warn(
                '[BLOG SERVICE] Canal de blog no encontrado, se omitirá la inicialización',
            )
        }
        if (!channel.isSendable()) {
            return logger.warn(
                '[BLOG SERVICE] El canal de panel no está disponible, se omitirá la inicialización',
            )
        }
        this.#channel = channel
    }

    async #buildMessagePanel({
        user,
        title,
        status = POST_STATUS.DRAFT,
        id,
    }: {
        title: string
        user: User
        id?: string
        status?: POST_STATUS
    }) {
        const statusText = {
            [POST_STATUS.DRAFT]: 'Draft',
            [POST_STATUS.OUTDATED]: 'Outdated',
            [POST_STATUS.PUBLISHED]: 'Published',
        }
        const container = new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                [
                    `# ${title}`,
                    `Autor: ${user}`,
                    `Estado: ${statusText[status]}`,
                ]
                    .filter(Boolean)
                    .join('\n'),
            ),
        )
        if (id && this.#posts.cache.get(id)!.cover_image_url) {
            container.addMediaGalleryComponents(
                new MediaGalleryBuilder().addItems(
                    new MediaGalleryItemBuilder().setURL(
                        this.#posts.cache.get(id)!.cover_image_url!,
                    ),
                ),
            )
        }
        if (id) {
            container.addActionRowComponents(
                new ActionRowBuilder<ButtonBuilder>().addComponents(
                    await blogState.build({ id, status }),
                    await blogTitle.build({ id }),
                    await blogCover.build({ id }),
                ),
            )
        }
        return container
    }

    async createDraft({
        member,
        title,
    }: {
        member: GuildMember
        title: string
    }) {
        if (!this.#channel) return
        const message = await this.#channel.send({
            flags: MessageFlags.IsComponentsV2,
            components: [
                await this.#buildMessagePanel({
                    title,
                    user: member.user,
                }),
            ],
        })
        const thread = await message.startThread({
            name: title,
            autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
        })
        const post = await this.#posts.create({
            discord_user_id: member.id,
            discord_username: member.user.username,
            thread_id: thread.id,
            title,
        })
        await message.edit({
            flags: MessageFlags.IsComponentsV2,
            components: [
                await this.#buildMessagePanel({
                    title,
                    user: member.user,
                    id: post.id,
                }),
            ],
        })
        await thread.members.add(member)
    }

    async #renderPanel() {
        const channel =
            client.channels.cache.get(envs.BLOG_CHANNEL_ID) ??
            (await client.channels.fetch(envs.BLOG_CHANNEL_ID))
        if (!channel) {
            return logger.warn('[BLOG SERVICE] Canal de panel no encontrado')
        }
        if (!channel.isSendable()) {
            return logger.warn(
                '[BLOG SERVICE] El canal de panel no está disponible',
            )
        }

        const container = await this.#buildPanel()

        if (this.#message) {
            await this.#message.edit({
                components: [container],
            })
        } else {
            const whpmid = await db.state.findUnique({
                where: { key: STATE_KEYS.BLOG_PANEL_MESSAGE_ID },
                select: { value: true },
            })
            if (whpmid) {
                const anc = await channel.messages
                    .fetch(whpmid.value)
                    .catch(() => null)
                if (anc) {
                    await anc.edit({
                        components: [container],
                    })
                } else {
                    await this.#checkPinned(channel, container)
                }
            } else {
                await this.#checkPinned(channel, container)
            }
        }
    }

    async #buildPanel() {
        const container = new ContainerBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    PANEL_NAME +
                        '\nCrea y administra borradores de entradas para el blog.',
                ),
            )
            .addSeparatorComponents(new SeparatorBuilder())
            .addActionRowComponents(
                new ActionRowBuilder<ButtonBuilder>().addComponents(
                    await blogCreate.build(),
                ),
            )

        return container
    }

    async #checkPinned(channel: SendableChannels, container: ContainerBuilder) {
        const pinned = await channel.messages.fetchPins()

        const my = pinned.items.find(msg => {
            const container = msg.message.components[0]
            if (!container) return false
            if (container.type !== ComponentType.Container) return false
            const textDisplay = container.components[0]
            if (!textDisplay) return false
            if (textDisplay.type !== ComponentType.TextDisplay) return false
            return (
                msg.message.author.id === client.user.id &&
                textDisplay.content.includes(PANEL_NAME)
            )
        })
        let nid: string
        if (my) {
            await my.message.edit({
                components: [container],
            })
            nid = my.message.id
        } else {
            this.#message = await channel.send({
                components: [container],
                flags:
                    MessageFlags.IsComponentsV2 |
                    MessageFlags.SuppressNotifications,
            })
            nid = this.#message.id
            await this.#message.pin()
        }
        await db.state.upsert({
            where: { key: STATE_KEYS.BLOG_PANEL_MESSAGE_ID },
            update: { value: nid },
            create: { key: STATE_KEYS.BLOG_PANEL_MESSAGE_ID, value: nid },
        })
    }

    async #outdate(post: Post, message: Message) {
        await post.outdate()
        const user = await client.users.fetch(post.discord_user_id, {
            cache: true,
        })
        await message.edit({
            flags: MessageFlags.IsComponentsV2,
            components: [
                await this.#buildMessagePanel({
                    user,
                    title: post.title,
                    id: post.id,
                    status: post.status,
                }),
            ],
        })
    }

    #installEventListener() {
        client.on(Events.MessageCreate, async message => {
            if (!message.inGuild()) return
            if (!message.channel.isThread()) return
            const post = this.#posts.cache.find(
                p => p.thread_id === message.channelId,
            )
            if (!post) return
            if (message.author.id !== post.discord_user_id) return
            if (post.status === POST_STATUS.DRAFT) return
            if (post.status === POST_STATUS.OUTDATED) return
            if (post.status === POST_STATUS.PUBLISHED) {
                const parent = await message.channel.fetchStarterMessage()
                if (!parent) return
                await this.#outdate(post, parent)
            }
        })

        client.on(Events.MessageUpdate, async message => {
            if (!message.inGuild()) return
            if (!message.channel.isThread()) return
            const post = this.#posts.cache.find(
                p => p.thread_id === message.channelId,
            )
            if (!post) return
            if (message.author.id !== post.discord_user_id) return
            if (post.status === POST_STATUS.DRAFT) return
            if (post.status === POST_STATUS.OUTDATED) return
            if (post.status === POST_STATUS.PUBLISHED) {
                const parent = await message.channel.fetchStarterMessage()
                if (!parent) return
                await this.#outdate(post, parent)
            }
        })
    }

    async publish(post: Post) {
        const channel =
            client.channels.cache.get(post.thread_id) ??
            (await client.channels.fetch(post.thread_id))

        if (!channel?.isThread()) return

        const original = await channel.fetchStarterMessage()
        if (!original) return

        const messages: Message<true>[] = []
        let lastId: string

        while (true) {
            const fetched = await channel.messages.fetch({
                limit: 100,
                before: lastId!,
            })

            if (fetched.size === 0) break

            messages.push(
                ...fetched
                    .filter(m => m.author.id === post.discord_user_id)
                    .values(),
            )

            lastId = fetched.last()!.id
        }

        if (messages.length === 0) return

        await post.publish(
            messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp),
        )

        const user = await client.users.fetch(post.discord_user_id, {
            cache: true,
        })

        await original.edit({
            flags: MessageFlags.IsComponentsV2,
            components: [
                await this.#buildMessagePanel({
                    user,
                    title: post.title,
                    id: post.id,
                    status: post.status,
                }),
            ],
        })
    }

    async changeTitle(post: Post, title: string) {
        await post.changeTitle(title)
        const user =
            client.users.cache.get(post.discord_user_id) ??
            (await client.users.fetch(post.discord_user_id))
        const message =
            this.#channel?.messages.cache.get(post.thread_id) ??
            (await this.#channel?.messages.fetch(post.thread_id))
        if (message) {
            await message.edit({
                flags: MessageFlags.IsComponentsV2,
                components: [
                    await this.#buildMessagePanel({
                        user,
                        title,
                        id: post.id,
                        status: post.status,
                    }),
                ],
            })
        }
        const thread =
            client.channels.cache.get(post.thread_id) ??
            (await client.channels.fetch(post.thread_id))
        if (thread && thread.isThread()) {
            await thread.edit({
                name: title,
            })
        }
    }

    async changeCoverImage(post: Post, imageUrl: string) {
        await post.changeCoverImage(imageUrl)
        const user =
            client.users.cache.get(post.discord_user_id) ??
            (await client.users.fetch(post.discord_user_id))
        const message =
            this.#channel?.messages.cache.get(post.thread_id) ??
            (await this.#channel?.messages.fetch(post.thread_id))
        if (message) {
            await message.edit({
                flags: MessageFlags.IsComponentsV2,
                components: [
                    await this.#buildMessagePanel({
                        user,
                        title: post.title,
                        id: post.id,
                        status: post.status,
                    }),
                ],
            })
        }
    }
}

export const blogService = new BlogService()
