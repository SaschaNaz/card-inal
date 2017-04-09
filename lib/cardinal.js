"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jsdom_1 = require("jsdom");
function parse(html, origin) {
    const doc = jsdom_1.jsdom(html, { features: { FetchExternalResources: false, ProcessExternalResources: false } });
    const metas = doc.getElementsByTagName("meta"); // Twitter collects <meta> not only from <head> but from everywhere
    const head = doc.createElement("head");
    for (const meta of Array.from(metas)) {
        head.appendChild(meta.cloneNode());
    }
    const cardType = getCardType(head);
    try {
        switch (cardType) {
            case "summary":
            case "summary_large_image":
                return parseSummary(head, cardType, origin);
            case "photo":
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
        err.message = `Malformed Twitter Card type '${cardType}': ${err.message || err}`;
        throw err;
    }
    // deprecated gallery and product card does not show active use, should just throw
    throw new Error(`Unsupported Twitter Card type '${cardType}'`);
}
exports.parse = parse;
/** Try getting twitter:card and then og:type */
function getCardType(head) {
    const card = getMetaContent(head, "card");
    if (card) {
        return card.value;
    }
    const ogTypeEl = getMeta(head, "og:type");
    if (ogTypeEl && getMetaProperty(ogTypeEl) === "article") {
        return "summary";
    }
}
function parseSummary(head, cardType, origin) {
    const card = { card: cardType, origin };
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
function parseDeprecatedGallery(head, origin) {
    const card = { card: "summary_large_image", origin };
    card.title = getMetaValue(head, "title", { ogTagName: "title", required: true });
    card.description = getMetaValue(head, "description", { ogTagName: "description" });
    card.image = getMetaValue(head, "image0", { ogTagName: "image", required: true });
    return card;
}
function parseApp(head) {
    const card = { card: "app" };
    card.site = getMetaContent(head, "site", { allowId: true }); // not really required by Twitter server, against the document
    card.description = getMetaValue(head, "description", { ogTagName: "description" });
    card.country = getMetaValue(head, "app:country");
    const appStoreList = ["iphone", "ipad", "googleplay"];
    card.appId = getMetaValueMap(head, appStoreList, { prefix: "app:id", required: true });
    card.appUrl = getMetaValueMap(head, appStoreList, { prefix: "app:url" });
    return card;
}
function parsePlayer(head) {
    const card = { card: "player" };
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
function parseAmplify(head) {
    const card = { card: "amplify" };
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
function getMeta(head, property) {
    return head.querySelector(`meta[name='${property}'], meta[property='${property}']`);
}
function getMetaProperty(meta) {
    return (meta.content || meta.getAttribute("value") || "").trim();
}
function getMetaContent(head, cardTagName, options) {
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
function getMetaValue(head, cardTagName, options) {
    const metaContent = getMetaContent(head, cardTagName, options);
    return metaContent ? metaContent.value : undefined;
}
function getMetaValueMap(head, cardTagNames, options) {
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
    const dict = {};
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
//# sourceMappingURL=cardinal.js.map