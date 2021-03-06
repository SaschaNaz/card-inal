import { JSDOM } from "jsdom"

export type TwitterCard = SummaryCard | AppCard | PlayerCard | AudioCard | AmplifyCard | LiveVideoCard | PeriscopeCard;

export interface ValueOrId {
    value?: string;
    id?: string;
}

export function parse(html: string | ArrayBuffer, origin: string): TwitterCard {
    const doc = new JSDOM(html).window.document;

    const metas = doc.getElementsByTagName("meta"); // Twitter collects <meta> not only from <head> but from everywhere
    const head = doc.createElement("head");
    for (const meta of Array.from(metas)) {
        head.appendChild(meta.cloneNode());
    }
    const cardType = getCardType(head);
    if (!cardType) {
        return;
    }
    try {
        switch (cardType) {
            case "summary":
            case "summary_large_image":
                return parseSummary(head, cardType, origin);
            case "photo": // yet used by flickr
                console.warn("Deprecated 'photo' card type is detected");
                return parseSummary(head, "summary_large_image", origin);
            case "gallery":
                console.warn("Deprecated 'gallery' card type is detected");
                return parseDeprecatedGallery(head, origin);
            case "app":
                return parseApp(head);
            case "player":
                return parsePlayer(head);
            case "audio":
                return parseAudio(head);
            case "product":
                console.warn("Deprecated 'product' card type is detected");
                return parseSummary(head, "summary", origin);
            case "amplify":
                return parseAmplify(head);
            case "745291183405076480:live_video":
            case "3691233323:periscope_broadcast":
                return parseUndocumented(head, cardType);
        }
    }
    catch (err) {
        err.message = `Malformed Twitter Card type '${cardType}': ${err.message || err}`;
        throw err;
    }

    // deprecated gallery and product card does not show active use, should just throw
    throw new Error(`Unsupported Twitter Card type '${cardType}'`);
}

/** Try getting twitter:card and then og:type */
function getCardType(head: HTMLHeadElement) {
    const card = getMetaContent(head, "card");
    if (card) {
        return card.value
    }
    const ogTypeEl = getMeta(head, "og:type");
    if (ogTypeEl && getMetaProperty(ogTypeEl) === "article") {
        return "summary"
    }
}

export interface SummaryCard {
    card: "summary" | "summary_large_image";
    origin: string;
    /** The Twitter @username the card is attributed to. */
    site: ValueOrId;
    /** A concise title for the related content. */
    title: string;
    /** A description that concisely summarizes the content as appropriate for presentation within a Tweet. */
    description: string;
    /** A URL to a unique image representing the content of the page. */
    image: string | null;
    /** A text description of the image conveying the essential nature of an image to users who are visually impaired. */
    imageAlt: string | null;
}

function parseSummary(head: HTMLHeadElement, cardType: "summary" | "summary_large_image", origin: string) {
    const card = { card: cardType, origin } as SummaryCard;

    card.site = getMetaContent(head, "site", { allowId: true }); // not really required by Twitter server, against the document
    card.title = getMetaValue(head, "title", { ogTagName: "title", required: true });
    card.description = getMetaValue(head, "description", { ogTagName: "description", required: true }).slice(0, 200);

    const image = getMetaContent(head, "image", { ogTagName: "image" });
    if (image) {
        card.image = image.value;

        const imageAlt = getMetaContent(head, "image:alt");
        if (imageAlt) {
            card.imageAlt = imageAlt.value;
        }
    }

    return card;
}

/**
 * Parses gallery card as summary_large_image one
 * @param head
 * @param origin
 */
function parseDeprecatedGallery(head: HTMLHeadElement, origin: string) {
    const card = { card: "summary_large_image", origin } as SummaryCard;

    card.title = getMetaValue(head, "title", { ogTagName: "title", required: true });
    card.description = getMetaValue(head, "description", { ogTagName: "description" });
    card.image = getMetaValue(head, "image0", { ogTagName: "image", required: true });

    return card;
}

export interface AppCard {
    card: "app";
    // The Twitter @username the card is attributed to. 
    site: ValueOrId;
    // More concise description than what you may have on the app store.
    description: string;
    // The two-letter country code for the App Store that contains your application.
    country: string;
    // The numeric representation of your app ID in the app store.
    appId: AppStoreData;
    // The app's custom URL scheme
    appUrl: AppStoreData;
}

export interface AppStoreData {
    iphone: string;
    ipad: string;
    googleplay: string;
}

function parseApp(head: HTMLHeadElement) {
    const card = { card: "app" } as AppCard;

    card.site = getMetaContent(head, "site", { allowId: true }); // not really required by Twitter server, against the document
    card.description = getMetaValue(head, "description", { ogTagName: "description" });
    card.country = getMetaValue(head, "app:country");

    const appStoreList = ["iphone", "ipad", "googleplay"];
    card.appId = getMetaValueMap(head, appStoreList, { prefix: "app:id", required: true }) as AppStoreData;
    card.appUrl = getMetaValueMap(head, appStoreList, { prefix: "app:url" }) as AppStoreData;

    return card;
}

export interface PlayerCard extends PlayerCardBody {
    card: "player";
}

export interface PlayerCardBody {
    /** The title of the content */
    title: string;
    /** The Twitter @username the card is attributed to */
    site: ValueOrId;
    /** A description of the content */
    description: string;
    player: string;
    playerWidth: number;
    playerHeight: number;
    image: string;
    imageAlt: string;
    playerStream: string;
    playerStreamContentType: string;
}

function parsePlayer(head: HTMLHeadElement) {
    const card = { card: "player" } as PlayerCard;

    card.title = getMetaValue(head, "title", { ogTagName: "title", required: true });
    card.site = getMetaContent(head, "site", { allowId: true });
    card.description = getMetaValue(head, "description", { ogTagName: "description" }).slice(0, 200);
    card.player = getMetaValue(head, "player", { required: true });
    card.playerWidth = parseInt(getMetaValue(head, "player:width", { required: true }));
    card.playerHeight = parseInt(getMetaValue(head, "player:height", { required: true }));
    card.image = getMetaValue(head, "image", { ogTagName: "image", required: true });
    if (card.image) {
        card.imageAlt = getMetaValue(head, "image:alt");
    }
    card.playerStream = getMetaValue(head, "player:stream");
    if (card.playerStream) {
        card.playerStreamContentType = getMetaValue(head, "player:stream:content_type");
    }

    return card;
}

export interface AudioCard extends PlayerCardBody {
    card: "audio";
    audioPartner: string;
    audioArtistName: string;
    audioSource: string;
}

function parseAudio(head: HTMLHeadElement) {
    const card = {
        ...parsePlayer(head),
        card: "audio"
    } as AudioCard;

    card.audioPartner = getMetaValue(head, "audio:partner", { required: true });
    card.audioArtistName = getMetaValue(head, "audio:artist_name", { required: true });
    card.audioSource = getMetaValue(head, "audio:source", { required: true });

    return card;
}

export interface AmplifyCard {
    card: "amplify";
    site: ValueOrId;
    title: string;
    description: string;
    imageSrc: string;
    imageWidth: number;
    imageHeight: number;
    amplifyVmap: string;
    amplifyTeaserSegmentsStream: string;
    amplifyContentId: string;
    playerWidth: number;
    playerHeight: number;
    playerStreamContentType: string;
    amplifyEmbeddable: boolean;
    amplifyDynamicAds: boolean;
    amplifyContentDurationSeconds: number;
    amplifyShareId: string;
}

function parseAmplify(head: HTMLHeadElement) {
    const card = { card: "amplify" } as AmplifyCard;

    // Amplify card is not documented, do not require anything here and consider all optional
    card.site = getMetaContent(head, "site", { allowId: true });
    card.title = getMetaValue(head, "title");
    card.description = getMetaValue(head, "description");
    card.imageSrc = getMetaValue(head, "image:src");
    card.imageWidth = parseInt(getMetaValue(head, "image:width"));
    card.imageHeight = parseInt(getMetaValue(head, "image:height"));
    card.amplifyVmap = getMetaValue(head, "amplify:vmap");
    card.amplifyTeaserSegmentsStream = getMetaValue(head, "amplify:teaser_segments_stream");
    card.amplifyContentId = getMetaValue(head, "amplify:content_id");
    card.playerWidth = parseInt(getMetaValue(head, "player:width"));
    card.playerHeight = parseInt(getMetaValue(head, "player:height"));
    card.playerStreamContentType = getMetaValue(head, "player:stream:content_type");
    card.amplifyEmbeddable = getMetaValue(head, "amplify:embeddable") === "true";
    card.amplifyDynamicAds = getMetaValue(head, "amplify:dynamic_ads") === "true";
    card.amplifyContentDurationSeconds = parseFloat(getMetaValue(head, "amplify:content_duration_seconds"));
    card.amplifyShareId = getMetaValue(head, "amplify:share_id");

    return card;
}

export interface LiveVideoCard {
    undocumented: true;

    card: "745291183405076480:live_video";
    title: string;
    text: {
        subtitle: string;
        eventId: string;
        state: string;
        mediaId: string;
        streamContentType: string;
        hostName: string;
        startTime: number;
    };
    imageThumbnail: {
        src: string;
        height: number;
        width: number;
    };
    amplifyDynamicAds: boolean;
}

export interface PeriscopeCard {
    undocumented: true,

    card: "3691233323:periscope_broadcast",
    site: ValueOrId,
    maxage: number,
    app: {
        name: { iphone: string, googleplay: string },
        id: { iphone: number, googleplay: string },
        url: {
            iphone: string,
            googleplay: string
        },
        country: string
    },
    player:
    {
        value: string,
        width: number,
        height: number
    },
    api: { api: { endpoint: number } },
    boolean: {
        _omit_link_: boolean,
        featured: boolean,
        available_for_replay: boolean,
        is_360: boolean
    },
    text: {
        id: string,
        status: string,
        total_participants: number,
        broadcast_state: string,
        broadcaster_id: string,
        broadcaster_twitter_id: number,
        broadcaster_username: string,
        broadcaster_display_name: string,
        broadcast_source: string,
        timecode: number,
        initial_camera_orientation: number,
        broadcast_width: number,
        broadcast_height: number
    },
    string: { broadcast_media_key: string },
    widgets: { csp: string }
}

function parseUndocumented(head: HTMLHeadElement, card: string) {
    return {
        card,
        undocumented: true,
        ...getAllMeta(head)
    } as PeriscopeCard;
}

interface MetaGetOptions {
    ogTagName?: string;
    required?: boolean;
}

function getMeta(head: HTMLHeadElement, property: string) {
    return head.querySelector(`meta[name='${property}'], meta[property='${property}']`) as HTMLMetaElement;
}

function getMetaProperty(meta: HTMLMetaElement) {
    return (meta.content || meta.getAttribute("value") || "").trim()
}

function getMetaContent(head: HTMLHeadElement, cardTagName: string, options?: MetaGetOptions & { allowId?: boolean; }): ValueOrId {
    let tagEl = getMeta(head, `twitter:${cardTagName}`);
    if (!tagEl && options && options.ogTagName) {
        tagEl = getMeta(head, `og:${options.ogTagName}`);
    }
    if (!tagEl && options && options.allowId) {
        tagEl = getMeta(head, `twitter:${cardTagName}:id`);
        if (tagEl) {
            return { id: getMetaProperty(tagEl) };
        }
    }
    if (!tagEl && options && options.required) {
        throw new Error(`The required 'twitter:${cardTagName}' tag does not exist`);
    }
    if (!tagEl) {
        return;
    }
    return { value: getMetaProperty(tagEl) };

    // TODO: What if site and site:id coexist?
}

function getMetaValue(head: HTMLHeadElement, cardTagName: string, options?: MetaGetOptions) {
    const metaContent = getMetaContent(head, cardTagName, options);
    return metaContent ? metaContent.value : undefined;
}

function getMetaValueMap(head: HTMLHeadElement, cardTagNames: string[], options?: { prefix?: string, required?: boolean }) {
    const prefix = options && options.prefix || "";
    const metas = cardTagNames.map(tagName => getMetaContent(head, `${prefix}:${tagName}`));
    if (!metas.every(meta => !!meta)) {
        if (options && options.required) {
            throw new Error(`At least one in ${cardTagNames} should be exist but found nothing`);
        }
        else {
            return;
        }
    }
    const dict = {} as any;
    for (let i = 0; i < cardTagNames.length; i++) {
        const meta = metas[i];
        if (!meta) {
            continue;
        }
        const tagName = cardTagNames[i];
        dict[tagName] = meta.value;
    }
    return dict;
}

function getAllMeta(head: HTMLHeadElement) {
    const map = getMetaMap(head);
    const object = {} as any;

    for (const [key, value] of map) {
        setRecursive(object, key, value);
    }

    return object;
}

function getMetaMap(head: HTMLHeadElement) {
    const metas = head.querySelectorAll("meta[name^='twitter:'],meta[property^='twitter:']") as NodeListOf<HTMLMetaElement>;
    const map = new Map<string, any>();
    for (const meta of Array.from(metas)) {
        const name = (meta.name || meta.getAttribute("property")).slice(8);
        const content = (meta.content || meta.getAttribute("value") || "").trim()
        if (content === 'true') {
            map.set(name, true);
        }
        else if (content === 'false') {
            map.set(name, false);
        }
        else if (!isNaN(content as any)) {
            map.set(name, Number(content));
        }
        else {
            map.set(name, content);
        }
    }
    return map;
}

function setRecursive(object: any, propertyPath: string, value: any) {
    const namespaceNames = propertyPath.split(':');
    const propertyName = namespaceNames.pop();
    let lastNamespace = object;

    for (const namespaceName of namespaceNames) {
        if (!lastNamespace[namespaceName]) {
            lastNamespace[namespaceName] = {};
        }
        else if (typeof lastNamespace[namespaceName] !== "object") {
            // twitter:player is a namespace and also a property path
            lastNamespace[namespaceName] = {
                value: lastNamespace[namespaceName]
            };
        }
        lastNamespace = lastNamespace[namespaceName];
    }
    lastNamespace[propertyName] = value;
}
