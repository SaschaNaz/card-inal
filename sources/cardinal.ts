export type TwitterCard = SummaryCard | AppCard | PlayerCard | AmplifyCard;

export interface ValueOrId {
    value?: string;
    id?: string;
}

export function parse(html: string, origin: string): TwitterCard {
    const doc = new DOMParser().parseFromString(html, "text/html");

    const metas = doc.getElementsByTagName("meta"); // Twitter collects <meta> not only from <head> but from everywhere
    const head = doc.createElement("head");
    for (const meta of Array.from(metas)) {
        head.appendChild(meta.cloneNode());
    }
    const cardEl = getMetaContent(head, "card");
    if (!cardEl) {
        return;
    }
    try {
        switch (cardEl.value) {
            case "summary":
            case "summary_large_image":
                return parseSummary(head, cardEl.value as any, origin);
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
            case "product":
                console.warn("Deprecated 'product' card type is detected");
                return parseSummary(head, "summary", origin);
            case "amplify":
                return parseAmplify(head);
        }
    }
    catch (err) {
        err.message = `Malformed Twitter Card type '${cardEl.value}': ${err.message || err}`;
        throw err;
    }

    // deprecated gallery and product card does not show active use, should just throw
    throw new Error(`Unsupported Twitter Card type '${cardEl.value}'`);
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

export interface PlayerCard {
    card: "player";
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

export function parseAmplify(head: HTMLHeadElement) {
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

interface MetaGetOptions {
    ogTagName?: string;
    required?: boolean;
}

function getMetaContent(head: HTMLHeadElement, cardTagName: string, options?: MetaGetOptions & { allowId?: boolean; }): ValueOrId {
    let tagEl = head.querySelector(`meta[name='twitter:${cardTagName}'], meta[property='twitter:${cardTagName}']`) as HTMLMetaElement;
    if (!tagEl && options && options.ogTagName) {
        tagEl = head.querySelector(`meta[name='og:${options.ogTagName}'], meta[property='og:${options.ogTagName}']`) as HTMLMetaElement;
    }
    if (!tagEl && options && options.allowId) {
        tagEl = head.querySelector(`meta[name='twitter:${cardTagName}:id'], meta[property='twitter:${cardTagName}:id']`) as HTMLMetaElement;
        if (tagEl) {
            return { id: (tagEl.content || tagEl.getAttribute("value") || "").trim() };
        }
    }
    if (!tagEl && options && options.required) {
        throw new Error(`The required 'twitter:${cardTagName}' tag does not exist`);
    }
    if (!tagEl) {
        return;
    }
    return { value: (tagEl.content || tagEl.getAttribute("value") || "").trim() };

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