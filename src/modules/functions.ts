import { API, IWallPostContextPayload } from "vk-io";
import { GroupsGroupFull, GroupsProfileItem } from "vk-io/lib/api/schemas/objects";
import { IGetPostLinkOptions, IProfile } from "../interfaces";

import { VK } from "./VK.js";

export function getResourceId(VK: VK, resource: string): Promise<number | null> {
    return VK.resolveResource(resource)
        .then(({ id, type }) => type === "user" ?
            id
            :
            type === "group" ?
                -id
                :
                null)
        .catch((error) => {
            console.error("[!] Произошла ошибка при получении ID-ресурса.");
            console.error(error);

            return null;
        });
}

export function getPostLink({ owner_id, id }: IGetPostLinkOptions): string {
    return `https://vk.com/wall${owner_id}_${id}`;
}

export function getPostAuthor(post: IWallPostContextPayload, profiles: GroupsProfileItem[], groups: GroupsGroupFull[]): IProfile | GroupsGroupFull {
    const author: (GroupsProfileItem | GroupsGroupFull)[] =
        post.from_id as number > 0 ?
            profiles.filter(({ id }) => id === post.from_id)
            :
            groups.filter(({ id }) => id === Math.abs(post.from_id as number));

    return author.map((profile: GroupsProfileItem | GroupsGroupFull) => {
        const { name, photo_50, first_name, last_name } = profile;

        if (name) {
            return profile as GroupsGroupFull;
        } else {
            return {
                name: `${first_name} ${last_name}`,
                photo_50
            } as IProfile;
        }
    })[0];
}

// eslint-disable-next-line require-await
export async function getById(api: API, id: number): Promise<IProfile | GroupsGroupFull | null> {
    return id ?
        id > 0 ?
            api.users.get({
                user_ids: String(id),
                fields: ["photo_50"]
            })
                .then(([{ first_name, last_name, photo_50 }]) => ({
                    name: `${first_name} ${last_name}`,
                    photo_50
                }))
            :
            api.groups.getById({
                group_id: String(Math.abs(id))
            })
                .then(([group]) => group)
        :
        null;
}
