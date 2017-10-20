export declare type TwitterCard = SummaryCard | AppCard | PlayerCard | AudioCard | AmplifyCard | LiveVideoCard;
export interface ValueOrId {
    value?: string;
    id?: string;
}
export declare function parse(html: string, origin: string): TwitterCard;
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
export interface AppCard {
    card: "app";
    site: ValueOrId;
    description: string;
    country: string;
    appId: AppStoreData;
    appUrl: AppStoreData;
}
export interface AppStoreData {
    iphone: string;
    ipad: string;
    googleplay: string;
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
export interface AudioCard extends PlayerCardBody {
    card: "audio";
    audioPartner: string;
    audioArtistName: string;
    audioSource: string;
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
