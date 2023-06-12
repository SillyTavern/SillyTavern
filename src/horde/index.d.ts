/// <reference types="node" />
import SuperMap from "@thunder04/supermap";
import { IncomingMessage } from "http";
declare enum ModelGenerationInputStableSamplers {
    "k_lms" = "k_lms",
    "k_heun" = "k_heun",
    "k_euler" = "k_euler",
    "k_dpm_2" = "k_dpm_2",
    "k_dpm_2_a" = "k_dpm_2_a",
    "DDIM" = "DDIM",
    "PLMS" = "PLMS",
    "k_dpm_fast" = "k_dpm_fast",
    "k_dpm_adaptive" = "k_dpm_adaptive",
    "k_dpmpp_2s_a" = "k_dpmpp_2s_a",
    "k_dpmpp_2m" = "k_dpmpp_2m",
    "dpmsolver" = "dpmsolver"
}
declare enum SourceImageProcessingTypes {
    "img2img" = "img2img",
    "inpainting" = "inpainting",
    "outpainting" = "outpainting"
}
declare enum ModelGenerationInputPostProcessingTypes {
    "GFPGAN" = "GFPGAN",
    "RealESRGAN_x4plus" = "RealESRGAN_x4plus",
    "CodeFormers" = "CodeFormers"
}
declare enum ModelInterrogationFormTypes {
    "caption" = "caption",
    "interrogation" = "interrogation",
    "nsfw" = "nsfw",
    "GFPGAN" = "GFPGAN",
    "RealESRGAN_x4plus" = "RealESRGAN_x4plus",
    "RealESRGAN_x4plus_anime_6B" = "RealESRGAN_x4plus_anime_6B",
    "NMKD_Siax" = "NMKD_Siax",
    "4x_AnimeSharp" = "4x_AnimeSharp",
    "CodeFormers" = "CodeFormers",
    "strip_background" = "strip_background"
}
declare enum HordeAsyncRequestStates {
    "waiting" = "waiting",
    "processing" = "processing",
    "done" = "done",
    "faulted" = "faulted",
    "partial" = "partial",
    "cancelled" = "cancelled"
}
declare enum ModelGenerationInputControlTypes {
    "canny" = "canny",
    "hed" = "hed",
    "depth" = "depth",
    "normal" = "normal",
    "openpose" = "openpose",
    "seg" = "seg",
    "scribble" = "scribble",
    "fakescribbles" = "fakescribbles",
    "hough" = "hough"
}
declare class APIError extends Error {
    rawError: RequestError;
    status: number;
    method: string;
    url: string;
    requestBody: any;
    constructor(rawError: RequestError, core_res: IncomingMessage, requestBody?: any);
    get name(): string;
}
declare class AIHorde {
    #private;
    static readonly ModelGenerationInputStableSamplers: typeof ModelGenerationInputStableSamplers;
    readonly ModelGenerationInputStableSamplers: typeof ModelGenerationInputStableSamplers;
    static readonly SourceImageProcessingTypes: typeof SourceImageProcessingTypes;
    readonly SourceImageProcessingTypes: typeof SourceImageProcessingTypes;
    static readonly ModelGenerationInputPostProcessingTypes: typeof ModelGenerationInputPostProcessingTypes;
    readonly ModelGenerationInputPostProcessingTypes: typeof ModelGenerationInputPostProcessingTypes;
    static readonly ModelGenerationInputControlTypes: typeof ModelGenerationInputControlTypes;
    readonly ModelGenerationInputControlTypes: typeof ModelGenerationInputControlTypes;
    static readonly ModelInterrogationFormTypes: typeof ModelInterrogationFormTypes;
    readonly ModelInterrogationFormTypes: typeof ModelInterrogationFormTypes;
    static readonly HordeAsyncRequestStates: typeof HordeAsyncRequestStates;
    readonly HordeAsyncRequestStates: typeof HordeAsyncRequestStates;
    static readonly APIError: typeof APIError;
    readonly APIError: typeof APIError;
    VERSION: string;
    ratings: AIHordeRatings;
    constructor(options?: AIHordeInitOptions);
    clearCache(): void;
    get cache(): AIHordeCache;
    parseAgent(agent: string): {
        name: string;
        version: string;
        link: string;
    };
    generateFieldsString(fields?: string[]): string | undefined;
    /**
     * Lookup user details based on their API key.
     * This can be used to verify a user exists
     * @param options.token - The token of the user; If none given the default from the constructor is used
     * @param options.fields - Array of fields that will be included in the returned data
     * @returns UserDetails - The user data of the requested user
     */
    findUser<T extends keyof UserDetails>(options?: {
        token?: string;
        fields?: T[];
    }): Promise<Pick<UserDetails, T>>;
    /**
     * Details and statistics about a specific user
     * @param id - The user ids to get
     * @param options.token - The token of the requesting user; Has to be Moderator, Admin or Reuqested users token
     * @param options.force - Set to true to skip cache
     * @param options.fields - Array of fields that will be included in the returned data
     * @returns UserDetails - The user data of the requested user
     */
    getUserDetails<T extends keyof UserDetails>(id: number, options?: {
        token?: string;
        force?: boolean;
        fields?: T[];
    }): Promise<Pick<UserDetails, T>>;
    /**
     * Details of a worker Team
     * @param id - The teams id to get
     * @param options.token - The token of the requesting user
     * @param options.force - Set to true to skip cache
     * @param options.fields - Array of fields that will be included in the returned data
     * @returns TeamDetailsStable - The team data
     */
    getTeam<T extends keyof TeamDetailsStable>(id: string, options?: {
        token?: string;
        force?: boolean;
        fields?: T[];
    }): Promise<Pick<TeamDetailsStable, T>>;
    /**
     * Details of a registered worker.
     * This can be used to verify a user exists
     * @param id - The id of the worker
     * @param options.token  - Moderator or API key of workers owner (gives more information if requesting user is owner or moderator)
     * @param options.force - Set to true to skip cache
     * @param options.fields - Array of fields that will be included in the returned data
     * @returns worker details for the requested worker
     */
    getWorkerDetails<T extends keyof WorkerDetailsStable>(id: string, options?: {
        token?: string;
        force?: boolean;
        fields?: T[];
    }): Promise<Pick<WorkerDetailsStable, T>>;
    /**
     * Retrieve the status of an Asynchronous generation request without images
     * Use this method to check the status of a currently running asynchronous request without consuming bandwidth.
     * @param id - The id of the generation
     * @param options.force - Set to true to skip cache
     * @param options.fields - Array of fields that will be included in the returned data
     * @returns RequestStatusCheck - The Check data of the Generation
     */
    getImageGenerationCheck<T extends keyof RequestStatusCheck>(id: string, options?: {
        force?: boolean;
        fields?: T[];
    }): Promise<Pick<RequestStatusCheck, T>>;
    /**
     * Retrieve the full status of an Asynchronous generation request
     * This method will include all already generated images in base64 encoded .webp files.
     * As such, you are requested to not retrieve this data often. Instead use the getGenerationCheck method first
     * This method is limited to 1 request per minute
     * @param id - The id of the generation
     * @param options.force - Set to true to skip cache
     * @param options.fields - Array of fields that will be included in the returned data
     * @returns RequestStatusStable - The Status of the Generation
     */
    getImageGenerationStatus<T extends keyof RequestStatusStable>(id: string, options?: {
        force?: boolean;
        fields?: T[];
    }): Promise<Pick<RequestStatusStable, T>>;
    /**
     * This request will include all already generated texts.
     * @param id - The id of the generation
     * @param options.force - Set to true to skip cache
     * @param options.fields - Array of fields that will be included in the returned data
     * @returns RequestStatusStable - The Status of the Generation
     */
    getTextGenerationStatus<T extends keyof RequestStatusKobold>(id: string, options?: {
        force?: boolean;
        fields?: T[];
    }): Promise<Pick<RequestStatusKobold, T>>;
    /**
     * This request will include all already generated images.
     * As such, you are requested to not retrieve this endpoint often. Instead use the /check/ endpoint first
     * @param options.force - Set to true to skip cache
     * @param options.fields - Array of fields that will be included in the returned data
     * @returns InterrogationStatus - The Status data of the Interrogation
     */
    getInterrogationStatus<T extends keyof InterrogationStatus>(id: string, options?: {
        force?: boolean;
        fields?: T[];
    }): Promise<Pick<InterrogationStatus, T>>;
    /**
     * If this loads, this node is available
     * @returns true - If request was successful, if not throws error
     */
    getHeartbeat(): Promise<true>;
    /**
     * Returns a list of models active currently in this horde
     * @param options.force - Set to true to skip cache
     * @param options.fields - Array of fields that will be included in the returned data
     * @returns ActiveModel[] - Array of Active Models
     */
    getModels<T extends keyof ActiveModel>(options?: {
        force?: boolean;
        fields?: T[];
    }): Promise<Pick<ActiveModel, T>[]>;
    /**
     * Horde Maintenance Mode Status
     * Use this method to quicky determine if this horde is in maintenance, invite_only or raid mode
     * @param options.token - Requires Admin or Owner API key
     * @param options.force - Set to true to skip cache
     * @param options.fields - Array of fields that will be included in the returned data
     * @returns HordeModes - The current modes of the horde
     */
    getModes<T extends keyof HordeModes>(options?: {
        token?: string;
        force?: boolean;
        fields?: T[];
    }): Promise<Pick<HordeModes, T>>;
    /**
     * Read the latest happenings on the horde
     * @param options.force - Set to true to skip cache
     * @param options.fields - Array of fields that will be included in the returned data
     * @returns Newspiece[] - Array of all news articles
     */
    getNews<T extends keyof Newspiece>(options?: {
        force?: boolean;
        fields?: T[];
    }): Promise<Pick<Newspiece, T>[]>;
    /**
     * Details about the current performance of this Horde
     * @param options.force - Set to true to skip cache
     * @param options.fields - Array of fields that will be included in the returned data
     * @returns HordePerformanceStable - The hordes current performance
     */
    getPerformance<T extends keyof HordePerformanceStable>(options?: {
        force?: boolean;
        fields?: T[];
    }): Promise<Pick<HordePerformanceStable, T>>;
    /**
     * A List with the details and statistic of all registered users
     * @param options.fields - Array of fields that will be included in the returned data
     * @returns UserDetails[] - An array of all users data
     */
    getUsers<T extends keyof UserDetails>(options?: {
        fields?: T[];
    }): Promise<Pick<UserDetails, T>[]>;
    /**
     * A List with the details of all registered and active workers
     * @param options.fields - Array of fields that will be included in the returned data
     * @returns An array of all workers data
     */
    getWorkers<T extends keyof WorkerDetailsStable>(options?: {
        fields?: T[];
    }): Promise<Pick<WorkerDetailsStable, T>[]>;
    /**
     * Details how many images were generated per model for the past day, month and total
     * @param options.fields - Array of fields that will be included in the returned data
     * @returns ImageModelStats - The stats
     */
    getImageModelStats<T extends keyof ImageModelStats>(options?: {
        fields?: T[];
    }): Promise<Pick<ImageModelStats, T>>;
    /**
     * Details how many images have been generated in the past minux,hour,day,month and total
     * @param options.fields - Array of fields that will be included in the returned data
     * @returns ImageTotalStats - The stats
     */
    getImageTotalStats<T extends keyof ImageModelStats>(options?: {
        fields?: T[];
    }): Promise<Pick<ImageTotalStats, T>>;
    /**
     * Details how many texts were generated per model for the past day, month and total
     * @param options.fields - Array of fields that will be included in the returned data
     * @returns TextModelStats - The stats
     */
    getTextModelStats<T extends keyof ImageModelStats>(options?: {
        fields?: T[];
    }): Promise<Pick<TextModelStats, T>>;
    /**
     * Details how many images have been generated in the past minux,hour,day,month and total
     * @param options.fields - Array of fields that will be included in the returned data
     * @returns TextTotalStats - The stats
     */
    getTextTotalStats<T extends keyof ImageModelStats>(options?: {
        fields?: T[];
    }): Promise<Pick<TextTotalStats, T>>;
    /**
     * A List with the details of all teams
     * @param options.fields - Array of fields that will be included in the returned data
     * @returns TeamDetailsStable[] - Array of Team Details
     */
    getTeams<T extends keyof TeamDetailsStable>(options?: {
        fields?: T[];
    }): Promise<Pick<TeamDetailsStable, T>[]>;
    /**
     * A List of filters
     * @param filter_type - The type of filter to show
     * @param options.token - The sending users API key; User must be a moderator
     * @param options.fields - Array of fields that will be included in the returned data
     * @returns FilterDetails[] - Array of Filter Details
     */
    getFilters<T extends keyof FilterDetails>(filter_type?: string, options?: {
        token?: string;
        fields?: T[];
    }): Promise<Pick<FilterDetails, T>[]>;
    /**
     * Gets Details for a specific filter
     * @param filter_id - The filter to show
     * @param options.token - The sending users API key; User must be a moderator
     * @param options.fields - Array of fields that will be included in the returned data
     * @returns FilterDetails - Filter Details
     */
    getFilter<T extends keyof FilterDetails>(filter_id?: string, options?: {
        token?: string;
        fields?: T[];
    }): Promise<Pick<FilterDetails, T>>;
    /**
     * Transfer Kudos to a registered user
     * @param check_data - The prompt to check
     * @param options.token - The sending users API key; User must be a moderator
     * @param options.fields - Array of fields that will be included in the returned data
     * @returns FilterPromptSuspicion
     */
    postFilters<T extends keyof FilterPromptSuspicion>(check_data: FilterCheckPayload, options?: {
        token?: string;
        fields?: T[];
    }): Promise<Pick<FilterPromptSuspicion, T>>;
    /**
     * Initiate an Asynchronous request to generate images
     * This method will immediately return with the UUID of the request for generation.
     * This method will always be accepted, even if there are no workers available currently to fulfill this request.
     * Perhaps some will appear in the next 10 minutes.
     * Asynchronous requests live for 10 minutes before being considered stale and being deleted.
     * @param generation_data - The data to generate the image
     * @param options.token - The token of the requesting user
     * @param options.fields - Array of fields that will be included in the returned data
     * @returns RequestAsync - The id and message for the async generation request
     */
    postAsyncImageGenerate<T extends keyof RequestAsync>(generation_data: GenerationInput, options?: {
        token?: string;
        fields?: T[];
    }): Promise<Pick<RequestAsync, T>>;
    /**
     * Initiate an Asynchronous request to generate text
     * This endpoint will immediately return with the UUID of the request for generation.
     * This endpoint will always be accepted, even if there are no workers available currently to fulfill this request.
     * Perhaps some will appear in the next 20 minutes.
     * Asynchronous requests live for 20 minutes before being considered stale and being deleted.
     * @param generation_data - The data to generate the text
     * @param options.token - The token of the requesting user
     * @param options.fields - Array of fields that will be included in the returned data
     * @returns RequestAsync - The id and message for the async generation request
     */
    postAsyncTextGenerate<T extends keyof RequestAsync>(generation_data: GenerationInputKobold, options?: {
        token?: string;
        fields?: T[];
    }): Promise<Pick<RequestAsync, T>>;
    /**
     * Submit aesthetic ratings for generated images to be used by LAION
     * The request has to have been sent as shared: true.
     * You can select the best image in the set, and/or provide a rating for each or some images in the set.
     * If you select best-of image, you will gain 4 kudos. Each rating is 5 kudos. Best-of will be ignored when ratings conflict with it.
     * You can never gain more kudos than you spent for this generation. Your reward at max will be your kudos consumption - 1.
     * @param generation_id - The ID of the generation to rate
     * @param rating - The data to rating data
     * @param options.token - The token of the requesting user
     * @param options.fields - Array of fields that will be included in the returned data
     * @returns GenerationSubmitted - The kudos awarded for the rating
     */
    postRating<T extends keyof GenerationSubmitted>(generation_id: string, rating: AestheticsPayload, options?: {
        token?: string;
        fields?: T[];
    }): Promise<Pick<GenerationSubmitted, T>>;
    /**
     * Check if there are generation requests queued for fulfillment
     * This endpoint is used by registered workers only
     * @param pop_input
     * @param options.token - The token of the registered user
     * @param options.fields - Array of fields that will be included in the returned data
     * @returns GenerationPayloadStable
     */
    postImageGenerationPop<T extends keyof GenerationPayloadStable>(pop_input: PopInputStable, options?: {
        token?: string;
        fields?: T[];
    }): Promise<Pick<GenerationPayloadStable, T>>;
    /**
     * Check if there are generation requests queued for fulfillment
     * This endpoint is used by registered workers only
     * @param pop_input
     * @param options.token - The token of the registered user
     * @param options.fields - Array of fields that will be included in the returned data
     * @returns GenerationPayloadKobold
     */
    postTextGenerationPop<T extends keyof GenerationPayloadKobold>(pop_input: PopInputKobold, options?: {
        token?: string;
        fields?: T[];
    }): Promise<Pick<GenerationPayloadKobold, T>>;
    /**
     * Submit a generated image
     * This endpoint is used by registered workers only
     * @param generation_submit
     * @param options.token - The workers owner API key
     * @param options.fields - Array of fields that will be included in the returned data
     * @returns GenerationSubmitted
     */
    postImageGenerationSubmit<T extends keyof GenerationSubmitted>(generation_submit: {
        id: string;
        generation: string;
        seed: string;
    }, options?: {
        token?: string;
        fields?: T[];
    }): Promise<Pick<GenerationSubmitted, T>>;
    /**
     * Submit generated text
     * This endpoint is used by registered workers only
     * @param generation_submit
     * @param options.token - The workers owner API key
     * @param options.fields - Array of fields that will be included in the returned data
     * @returns GenerationSubmitted
     */
    postTextGenerationSubmit<T extends keyof GenerationSubmitted>(generation_submit: {
        id: string;
        generation: string;
        state: "ok" | "censored" | "faulted";
    }, options?: {
        token?: string;
        fields?: T[];
    }): Promise<Pick<GenerationSubmitted, T>>;
    /**
     * Initiate an Asynchronous request to interrogate an image.
     * This endpoint will immediately return with the UUID of the request for interrogation.
     * This endpoint will always be accepted, even if there are no workers available currently to fulfill this request.
     * Perhaps some will appear in the next 20 minutes.
     * Asynchronous requests live for 20 minutes before being considered stale and being deleted.
     * @param interrogate_payload
     * @param options.token - The sending users API key
     * @param options.fields - Array of fields that will be included in the returned data
     * @returns RequestInterrogationResponse
     */
    postAsyncInterrogate<T extends keyof RequestInterrogationResponse>(interrogate_payload: ModelInterrogationInputStable, options?: {
        token?: string;
        fields?: T[];
    }): Promise<Pick<RequestInterrogationResponse, T>>;
    /**
     * Check if there are interrogation requests queued for fulfillment
     * This endpoint is used by registered workers only
     * @param pop_input
     * @param options.token - The token of the registered user
     * @param options.fields - Array of fields that will be included in the returned data
     * @returns InterrogationPopPayload
     */
    postInterrogationPop<T extends keyof InterrogationPopPayload>(pop_input: InterrogationPopInput, options?: {
        token?: string;
        fields?: T[];
    }): Promise<Pick<InterrogationPopPayload, T>>;
    /**
     * Submit the results of an interrogated image
     * This endpoint is used by registered workers only
     * @param generation_submit
     * @param options.token - The workers owner API key
     * @param options.fields - Array of fields that will be included in the returned data
     * @returns GenerationSubmitted
     */
    postInterrogationSubmit<T extends keyof GenerationSubmitted>(interrogation_submit: {
        id: string;
        result: string;
    }, options?: {
        token?: string;
        fields?: T[];
    }): Promise<Pick<GenerationSubmitted, T>>;
    /**
     * Transfer Kudos to a registered user
     * @param transfer_data - The data specifiying who to send how many kudos
     * @param options.token - The sending users API key
     * @param options.fields - Array of fields that will be included in the returned data
     * @returns KudosTransferred
     */
    postKudosTransfer<T extends keyof KudosTransferred>(transfer_data: {
        username: string;
        amount: number;
    }, options?: {
        token?: string;
        fields?: T[];
    }): Promise<Pick<KudosTransferred, T>>;
    /**
     * Receive kudos from the KoboldAI Horde
     * @param user_id - The stable horde user id of the receiving user
     * @param transfer_data - The data specifiying who to send how many kudos
     * @param options.token - The sending users API key
     * @param options.fields - Array of fields that will be included in the returned data
     * @returns null
     */
    postKoboldTransfer(user_id: string, transfer_data: {
        kai_id: string;
        kudos_amount: number;
        trusted: boolean;
    }, options?: {
        token?: string;
    }): Promise<null>;
    /**
     * Create a new team
     * Only trusted users can create new teams.
     * @param create_payload - The data to create the team with
     * @param options.token - The API key of a trusted user
     * @param options.fields - Array of fields that will be included in the returned data
     * @returns ModifyTeam
     */
    createTeam<T extends keyof ModifyTeam>(create_payload: CreateTeamInput, options?: {
        token?: string;
        fields?: T[];
    }): Promise<Pick<ModifyTeam, T>>;
    /** PUT */
    /**
     * Change Horde Modes
     * @param modes - The new status of the Horde
     * @param options.token - Requires Admin API key
     * @param options.fields - Array of fields that will be included in the returned data
     * @returns HordeModes
     */
    putStatusModes<T extends keyof HordeModes>(modes: {
        maintenance: boolean;
        shutdown: number;
        invite_only: boolean;
        raid: boolean;
    }, options?: {
        token?: string;
        fields?: T[];
    }): Promise<Pick<HordeModes, T>>;
    /**
     * Method for horde admins to perform operations on users
     * @param update_payload - The data to change on the target user
     * @param id - The targeted users ID
     * @param options.token - Requires Admin API key
     * @param options.fields - Array of fields that will be included in the returned data
     * @returns ModifyUser
     */
    updateUser<T extends keyof ModifyUser>(update_payload: ModifyUserInput, id: number, options?: {
        token?: string;
        fields?: T[];
    }): Promise<Pick<ModifyUser, T>>;
    /**
     * Put the worker into maintenance or pause mode
     * Maintenance can be set by the owner of the serve or an admin.
     * When in maintenance, the worker will receive a 503 request when trying to retrieve new requests. Use this to avoid disconnecting your worker in the middle of a generation
     * Paused can be set only by the admins of this Horde.
     * When in paused mode, the worker will not be given any requests to generate.
     * @param update_payload - The data to change on the target worker
     * @param id - The targeted workers ID
     * @param options.token - The worker owners API key or Admin API key
     * @param options.fields - Array of fields that will be included in the returned data
     * @returns ModifyWorker
     */
    updateWorker<T extends keyof ModifyWorker>(update_payload: ModifyWorkerInput, id: string, options?: {
        token?: string;
        fields?: T[];
    }): Promise<ModifyWorker>;
    /** PATCH */
    /**
     * Updates a Team's information
     * @param update_payload - The data to update the team with
     * @param options.token - The Moderator or Creator API key
     * @param options.fields - Array of fields that will be included in the returned data
     * @returns ModifyTeam
     */
    updateTeam<T extends keyof ModifyTeam>(update_payload: ModifyTeamInput, id: string, options?: {
        token?: string;
        fields?: T[];
    }): Promise<Pick<ModifyTeam, T>>;
    /**
     * Adds a new regex filer
     * @param create_payload - The data to create the filter with
     * @param options.token - The Moderator API key
     * @param options.fields - Array of fields that will be included in the returned data
     * @returns FilterDetails
     */
    addFilter<T extends keyof FilterDetails>(create_payload: PutNewFilter, id: string, options?: {
        token?: string;
        fields?: T[];
    }): Promise<Pick<FilterDetails, T>>;
    /** PATCH */
    /**
     * Updates an existing regex filer
     * @param update_payload - The data to update the filter with
     * @param options.token - The Moderator API key
     * @param options.fields - Array of fields that will be included in the returned data
     * @returns FilterDetails
     */
    updateFilter<T extends keyof FilterDetails>(update_payload: PatchExistingFilter, id: string, options?: {
        token?: string;
        fields?: T[];
    }): Promise<Pick<FilterDetails, T>>;
    /** DELETE */
    /**
     * Cancel an unfinished request
     * This request will include all already generated images in base64 encoded .webp files.
     * @param id - The targeted generations ID
     * @param options.fields - Array of fields that will be included in the returned data
     * @returns RequestStatusStable
     */
    deleteImageGenerationRequest<T extends keyof RequestStatusStable>(id: string, options?: {
        fields?: T[];
    }): Promise<Pick<RequestStatusStable, T>>;
    /**
     * Cancel an unfinished request
     * This request will include all already generated images in base64 encoded .webp files.
     * @param id - The targeted generations ID
     * @param options.fields - Array of fields that will be included in the returned data
     * @returns RequestStatusKobold
     */
    deleteTextGenerationRequest<T extends keyof RequestStatusKobold>(id: string, options?: {
        fields?: T[];
    }): Promise<Pick<RequestStatusKobold, T>>;
    /**
     * Cancel an unfinished interrogation request
     * This request will return all already interrogated image results.
     * @param id - The targeted generations ID
     * @param options.fields - Array of fields that will be included in the returned data
     * @returns InterrogationStatus
     */
    deleteInterrogationRequest<T extends keyof InterrogationStatus>(id: string, options?: {
        fields?: T[];
    }): Promise<Pick<InterrogationStatus, T>>;
    /**
     * Delete the worker entry
     * This will delete the worker and their statistics. Will not affect the kudos generated by that worker for their owner.
     * Only the worker's owner and an admin can use this endpoint.
     * This action is unrecoverable!
     * @param id - The targeted workers ID
     * @param options.token - The worker owners API key or a Moderators API key
     * @param options.fields - Array of fields that will be included in the returned data
     * @returns DeletedWorker
     */
    deleteWorker<T extends keyof DeletedWorker>(id: string, options?: {
        token?: string;
        fields?: T[];
    }): Promise<DeletedWorker>;
    /**
     * Delete the team entry
     * Only the team's creator or a horde moderator can use this endpoint.
     * This action is unrecoverable!
     * @param id - The targeted teams ID
     * @param options.token - The worker owners API key or a Moderators API key
     * @param options.fields - Array of fields that will be included in the returned data
     * @returns DeletedTeam
     */
    deleteTeam<T extends keyof DeletedTeam>(id: string, options?: {
        token?: string;
        fields?: T[];
    }): Promise<Pick<DeletedTeam, T>>;
    /**
     * Remove an IP from timeout
     * Only usable by horde moderators
     * @param ip - The IP address
     * @param options.token - Moderators API key
     * @param options.fields - Array of fields that will be included in the returned data
     * @returns SimpleResponse
     */
    deleteIPTimeout<T extends keyof SimpleResponse>(delete_payload: DeleteTimeoutIPInput, options?: {
        token?: string;
        fields?: T[];
    }): Promise<Pick<SimpleResponse, T>>;
    /**
     * Delete a regex filter
     * @param filter_id - The ID of the filter to delete
     * @param options.token - The sending users API key; User must be a moderator
     * @param options.fields - Array of fields that will be included in the returned data
     * @returns SimpleResponse
     */
    deleteFilter<T extends keyof SimpleResponse>(filter_id: string, options?: {
        token?: string;
        fields?: T[];
    }): Promise<Pick<SimpleResponse, T>>;
}
export = AIHorde;
export interface AIHordeInitOptions {
    /** The configuration for caching results */
    cache?: AIHordeCacheConfiguration;
    /**
     * The interval to check expired data in the cache
     * @default 1000
    */
    cache_interval?: number;
    /** The default token to use for requests */
    default_token?: string;
    /** The base api domain + route to use for requests */
    api_route?: string;
    /** The ratings api domain + route to use for requests */
    ratings_api_route?: string;
    /** The client agent to pass in the requests. */
    client_agent?: string;
}
export interface AIHordeCacheConfiguration {
    /** How long to cache a specific user for in Milliseconds */
    users?: number;
    /** How long to cache generation check data for in Milliseconds */
    generations_check?: number;
    /** How long to cache generation status data for in Milliseconds */
    generations_status?: number;
    /** How long to cache interrogation status data for in Milliseconds */
    interrogations_status?: number;
    /** How long to cache models for in Milliseconds */
    models?: number;
    /** How long to cache modes for in Milliseconds */
    modes?: number;
    /** How long to cache news for in Milliseconds */
    news?: number;
    /** How long to cache performance for in Milliseconds */
    performance?: number;
    /** How long to cache workers for in Milliseconds */
    workers?: number;
    /** How long to cache teams for in Milliseconds */
    teams?: number;
}
interface AIHordeCache {
    users?: SuperMap<string, UserDetails>;
    generations_check?: SuperMap<string, RequestStatusCheck>;
    generations_status?: SuperMap<string, RequestStatusStable>;
    interrogations_status?: SuperMap<string, InterrogationStatus>;
    models?: SuperMap<string, ActiveModel[]>;
    modes?: SuperMap<string, HordeModes>;
    news?: SuperMap<string, Newspiece[]>;
    performance?: SuperMap<string, HordePerformanceStable>;
    workers?: SuperMap<string, WorkerDetailsStable>;
    teams?: SuperMap<string, TeamDetails>;
}
export interface ModifyUserInput {
    /** The amount of kudos to modify (can be negative) */
    kudos?: number;
    /**
     * The amount of concurrent request this user can have
     * @minimum 0
     * @maximum 100
    */
    concurrency?: number;
    /**
     * The amount by which to multiply the users kudos consumption
     * @minimum 0.1
     * @maximum 10
    */
    usage_multiplier?: number;
    /** Set to the amount of workers this user is allowed to join to the horde when in worker invite-only mode. */
    worker_invited?: number;
    /**
     * Set to true to Make this user a horde moderator
     * @example false
    */
    moderator?: boolean;
    /**
     * Set to true to Make this user a display their worker IDs
     * @example false
    */
    public_workers?: boolean;
    /**
     * When specified, will start assigning the user monthly kudos, starting now!
     * @minimum 0
    */
    monthly_kudos?: number;
    /**
     * When specified, will change the username. No profanity allowed!
     * @minLength 3
     * @maxLength 100
    */
    username?: string;
    /**
     * When set to true,the user and their servers will not be affected by suspicion
     * @example false
    */
    trusted?: boolean;
    /** Set the user's suspicion back to 0 */
    reset_suspicion?: boolean;
    /**
     * Contact details for the horde admins to reach the user in case of emergency. This is only visible to horde moderators.
     * @example email@example.com
     * @minLength 5
     * @maxLength 500
    */
    contact?: string;
}
export interface ModifyWorkerInput {
    /** (Mods only) Set to true to put this worker into maintenance. */
    maintenance?: boolean;
    /** (Mods only) Set to true to pause this worker. */
    paused?: boolean;
    /**
     * You can optionally provide a server note which will be seen in the server details. No profanity allowed!
     * @minLength 5
     * @maxLength 1000
    */
    info?: string;
    /**
     * When this is set, it will change the worker's name. No profanity allowed!
     * @minLength 5
     * @maxLength 100
    */
    name?: string;
    /**
     * The team towards which this worker contributes kudos. No profanity allowed!
     * @example 0bed257b-e57c-4327-ac64-40cdfb1ac5e6
     * @minLength 3
     * @maxLength 100
    */
    team?: string;
}
/**
 * @link https://aihorde.net/api/
*/
export interface GenerationInputKobold {
    /** The prompt which will be sent to KoboldAI to generate text */
    prompt?: string;
    params?: ModelGenerationInputKobold;
    /**
     * Specify which softpompt needs to be used to service this request
     * @minLength 1
     */
    softprompt?: string;
    /**
     * When true, only trusted workers will serve this request. When False, Evaluating workers will also be used which can increase speed but adds more risk!
     * @default true
     */
    trusted_workers?: boolean;
    /** Specify which workers are allowed to service this request */
    workers?: string[];
    /** Specify which models are allowed to be used for this request */
    models?: string[];
}
export interface ModelGenerationInputKobold {
    /**
     * @example 1
     * @minimum 1
     * @maximum 20
     */
    n?: number;
    /**
     * Input formatting option. When enabled, adds a leading space to your input if there is no trailing whitespace at the end of the previous action.
     * @example false
     */
    frmtadsnsp?: boolean;
    /**
     * Output formatting option. When enabled, replaces all occurrences of two or more consecutive newlines in the output with one newline.
     * @example false
     */
    frmtrmblln?: boolean;
    /**
     * Output formatting option. When enabled, removes #/@%}{+=~|^<> from the output.
     * @example false
     */
    frmtrmspch?: boolean;
    /**
     * Output formatting option. When enabled, removes some characters from the end of the output such that the output doesn't end in the middle of a sentence. If the output is less than one sentence long, does nothing.
     * @example false
     */
    frmttriminc?: boolean;
    /**
     * Maximum number of tokens to send to the model.
     * @example 1024
     * @minimum 80
     * @maximum 2048
     */
    max_context_length?: number;
    /**
     * Number of tokens to generate.
     * @minimum 16
     * @maximum 512
     */
    max_length?: number;
    /**
     * Base repetition penalty value.
     * @maximum 1
     */
    rep_pen?: number;
    /** Repetition penalty range. */
    rep_pen_range?: number;
    /** Repetition penalty slope. */
    rep_pen_slope?: number;
    /**
     * Output formatting option. When enabled, removes everything after the first line of the output, including the newline.
     * @example false
     */
    singleline?: boolean;
    /** Soft prompt to use when generating. If set to the empty string or any other string containing no non-whitespace characters, uses no soft prompt. */
    soft_prompt?: string;
    /**
     * Temperature value.
     * @minimum 0
     */
    temperature?: number;
    /** Tail free sampling value. */
    tfs?: number;
    /** Top-a sampling value. */
    top_a?: number;
    /** Top-k sampling value. */
    top_k?: number;
    /** Top-p sampling value. */
    top_p?: number;
    /** Typical sampling value. */
    typical?: number;
    /** Array of integers representing the sampler order to be used */
    sample_order?: number[];
}
export interface ModelPayloadKobold extends ModelGenerationInputKobold {
    prompt?: string;
}
export interface GenerationInput {
    /** The prompt which will be sent to Stable Diffusion to generate an image */
    prompt: string;
    /** The parameters for the generation */
    params?: ModelGenerationInputStable;
    /**
     * Set to true if this request is NSFW. This will skip workers which censor images.
     * @default false
    */
    nsfw?: boolean;
    /**
     * When true, only trusted workers will serve this request. When False, Evaluating workers will also be used which can increase speed but adds more risk!
     * @default true
    */
    trusted_workers?: boolean;
    /**
     * When True, allows slower workers to pick up this request. Disabling this incurs an extra kudos cost.
     * @default true
    */
    slow_workers?: boolean;
    /**
     * If the request is SFW, and the worker accidentaly generates NSFW, it will send back a censored image.
     * @default false
    */
    censor_nsfw?: boolean;
    /** Specify which workers are allowed to service this request */
    workers?: string[];
    /** Specify which models are allowed to be used for this request */
    models?: string[];
    /** The Base64-encoded webp to use for img2img, max siue 3072 * 3072 */
    source_image?: string;
    /** If source_image is provided, specifies how to process it. */
    source_processing?: typeof AIHorde.SourceImageProcessingTypes[keyof typeof AIHorde.SourceImageProcessingTypes];
    /** If source_processing is set to 'inpainting' or 'outpainting', this parameter can be optionally provided as the Base64-encoded webp mask of the areas to inpaint. If this arg is not passed, the inpainting/outpainting mask has to be embedded as alpha channel */
    source_mask?: string;
    /** If True, the image will be sent via cloudflare r2 download link */
    r2?: boolean;
    /** If True, The image will be shared with LAION for improving their dataset. This will also reduce your kudos consumption by 2. For anonymous users, this is always True. */
    shared?: boolean;
    /**
     * If enabled, suspicious prompts are sanitized through a string replacement filter instead.
     * @default true
    */
    replacement_filter?: boolean;
}
export interface ModelGenerationInputStable {
    /**
     * @default k_euler
    */
    sampler_name?: typeof AIHorde.ModelGenerationInputStableSamplers[keyof typeof AIHorde.ModelGenerationInputStableSamplers];
    /**
     * Special Toggles used in the SD Webui. To be documented.
    */
    toggles?: number[];
    /**
     * its how much the AI listens to your prompt, essentially.
     * @default 5
     * @minimum -40
     * @maximum 30
     *
     * Multiple of 0.5
    */
    cfg_scale?: number;
    /**
     * The strength of denoising
     * @minimum 0
     * @maximum 1
     *
     * Multiple of 0.01
    */
    denoising_strength?: number;
    /** The seed to use to generete this request. */
    seed?: string;
    /**
     * The height of the image to generate
     * @default 512
     * @minimum 64
     * @maximum 3072
     *
     * Multiple of 64
    */
    height?: number;
    /**
     * The width of the image to generate
     * @default 512
     * @minimum 64
     * @maximum 3072
     *
     * Multiple of 64
    */
    width?: number;
    /**
     * If passed with multiple n, the provided seed will be incremented every time by this value
     * @minimum 1
     * @maximum 1000
    */
    seed_variation?: number;
    /** Set to True to enable karras noise scheduling tweaks */
    karras?: boolean;
    /** The list of post-processors to apply to the image, in the order to be applied */
    post_processing?: (typeof AIHorde.ModelGenerationInputPostProcessingTypes[keyof typeof AIHorde.ModelGenerationInputPostProcessingTypes])[];
    /**
     * Set to True to create images that stitch together seamlessly
     * @default false
    */
    tiling?: boolean;
    /**
     * Set to True to process the image at base resolution before upscaling and re-processing
     * @default false
    */
    hires_fix?: boolean;
    /**
     * The number of CLIP language processor layers to skip
     * @minimum 1
     * @maximum 12
    */
    clip_skip?: number;
    control_type?: (typeof AIHorde.ModelGenerationInputControlTypes[keyof typeof AIHorde.ModelGenerationInputControlTypes]);
    /**
     * Set to True if the image submitted is a pre-generated control map for ControlNet use
     * @default false
     */
    image_is_control?: boolean;
    /**
     * Set to True if you want the ControlNet map returned instead of a generated image
     * @default false
     */
    return_control_map?: boolean;
    /**
     * @example 0.75
     * @minimum 0
     * @maximum 1
     */
    facefixer_strength?: number;
    /**
     * @default 30
     * @minimum 1
     * @maximum 500
    */
    steps?: number;
    /**
     * The amount of images to generate
     * @minimum 1
     * @maximum 20
    */
    n?: number;
}
export interface ModelPayloadRootStable {
    /**
     * @default k_euler
    */
    sampler_name?: typeof AIHorde.ModelGenerationInputStableSamplers[keyof typeof AIHorde.ModelGenerationInputStableSamplers];
    /**
     * Special Toggles used in the SD Webui. To be documented.
    */
    toggles?: number[];
    /**
     * its how much the AI listens to your prompt, essentially.
     * @default 5
     * @minimum -40
     * @maximum 30
     *
     * Multiple of 0.5
    */
    cfg_scale?: number;
    /**
     * The strength of denoising
     * @minimum 0
     * @maximum 1
     *
     * Multiple of 0.01
    */
    denoising_strength?: number;
    /** The seed to use to generete this request. */
    seed?: string;
    /**
     * The height of the image to generate
     * @default 512
     * @minimum 64
     * @maximum 1024
     *
     * Multiple of 64
    */
    height?: number;
    /**
     * The width of the image to generate
     * @default 512
     * @minimum 64
     * @maximum 1024
     *
     * Multiple of 64
    */
    width?: number;
    /**
     * If passed with multiple n, the provided seed will be incremented every time by this value
     * @minimum 1
     * @maximum 1000
    */
    seed_variation?: number;
    /** Set to True to enable karras noise scheduling tweaks */
    karras?: boolean;
    /** Set to true to process the generated image with GFPGAN (face correction) */
    use_gfpgan?: boolean;
    /** Set to true to process the generated image with RealESRGAN */
    use_real_esrgan?: boolean;
    /** Set to true to process the generated image with LDSR */
    use_ldsr?: boolean;
    /** Set to true to upscale the image */
    use_upscaling?: boolean;
}
export interface RequestError {
    /** The error message for this status code. */
    message: string;
}
export interface RequestStatusStable extends RequestStatusCheck {
    generations?: GenerationStable[];
}
export interface RequestStatusKobold extends RequestStatusCheck {
    generations?: GenerationKobold[];
}
export interface RequestStatusCheck {
    /** The amount of finished images in this request */
    finished?: number;
    /** The amount of still processing images in this request */
    processing?: number;
    /** The amount of images waiting to be picked up by a worker */
    waiting?: number;
    /** True when all images in this request are done. Else False. */
    done?: boolean;
    /** rue when this request caused an internal server error and cannot be completed. */
    faulted?: boolean;
    /** The expected amount to wait (in seconds) to generate all images in this request */
    wait_time?: number;
    /** The position in the requests queue. This position is determined by relative Kudos amounts. */
    queue_position?: number;
    /** The amount of total Kudos this request has consumed until now. */
    kudos?: number;
    /** If False, this request will not be able to be completed with the pool of workers currently available */
    is_possible?: boolean;
}
export interface Generation {
    /** The UUID of the worker which generated this image */
    worker_id?: string;
    /** The name of the worker which generated this image */
    worker_name?: string;
    /** The model which generated this image */
    model?: string;
}
export interface GenerationStable extends Generation {
    /** The generated image as a Base64-encoded .webp file OR a cloudflare r2 download link */
    img?: string;
    /** The seed which generated this image */
    seed?: string;
    /** The ID for this image */
    id?: string;
    /** When true this image has been censored by the worker's safety filter. */
    censored?: boolean;
}
export interface GenerationKobold extends Generation {
    /**
     * The state of the generation,
     * @default ok
     * @example ok
     */
    state: "ok" | "censored";
    /** The generated text */
    text?: string;
    /** The seed which generated this text */
    seed: number;
}
export interface RequestAsync {
    /** The UUID of the request. Use this to retrieve the request status in the future */
    id?: string;
    /** Any extra information from the horde about this request */
    message?: string;
}
export interface PopInputStable extends PopInput {
    /**
     * The maximum amount of pixels this worker can generate
     * @default 262144
    */
    max_pixels?: number;
    /** Words which, when detected will refuse to pick up any jobs */
    blacklist?: string[];
}
export interface PopInputKobold extends PopInput {
    /**
     * The maximum amount of pixels this worker can generate
     * @default 262144
    */
    max_pixels?: number;
    /** Words which, when detected will refuse to pick up any jobs */
    blacklist?: string[];
}
export interface PopInput {
    /** The Name of the Worker */
    name?: string;
    /** Users with priority to use this worker */
    priority_usernames?: string[];
    /**
     * Whether this worker can generate NSFW requests or not.
     * @default false
    */
    nsfw?: boolean;
    /** Which models this worker is serving */
    models?: string[];
    /**
     * The version of the bridge used by this worker
     * @default 1
    */
    bridge_version: number;
    /**
     * The worker name, version and website
     * @default unknown:0:unknown
     * @example AI Horde Worker:11:https://github.com/db0/AI-Horde-Worker
     * @maxLength 1000
     */
    bridge_agent?: string;
    /**
     * How many threads this worker is running. This is used to accurately the current power available in the horde
     * @default 1
     * @minimum 1
     * @maximum 10
     */
    threads?: number;
    /**
     * If True, this worker will only pick up requests where the owner has the required kudos to consume already available
     * @default false
     * @example false
     */
    require_upfront_kudos?: boolean;
}
export interface GenerationPayloadStable {
    payload?: ModelPayloadStable;
    /** The UUID for this image generation */
    id?: string;
    skipped?: NoValidRequestFoundStable;
    /** Which of the available models to use for this request */
    model?: string;
    /** The Base64-encoded webp to use for img2img */
    source_image?: string;
}
export interface GenerationPayloadKobold {
    payload?: ModelPayloadKobold;
    /** The UUID for this text */
    id?: string;
    skipped?: NoValidRequestFoundKobold;
    /** The soft prompt requested for this generation */
    softprompt?: string;
    /** Which of the available models to use for this request */
    model?: string;
}
export interface ModelPayloadStable {
    /**
     * @default k_euler
    */
    sampler_name?: typeof AIHorde.ModelGenerationInputStableSamplers[keyof typeof AIHorde.ModelGenerationInputStableSamplers];
    /**
     * Special Toggles used in the SD Webui. To be documented.
    */
    toggles?: number[];
    /**
     * its how much the AI listens to your prompt, essentially.
     * @default 5
     * @minimum -40
     * @maximum 30
     *
     * Multiple of 0.5
    */
    cfg_scale?: number;
    /**
     * The strength of denoising
     * @minimum 0
     * @maximum 1
     *
     * Multiple of 0.01
    */
    denoising_strength?: number;
    /** The seed to use to generete this request. */
    seed?: string;
    /**
     * The height of the image to generate
     * @default 512
     * @minimum 64
     * @maximum 3072
     *
     * Multiple of 64
    */
    height?: number;
    /**
     * The width of the image to generate
     * @default 512
     * @minimum 64
     * @maximum 3072
     *
     * Multiple of 64
    */
    width?: number;
    /**
     * If passed with multiple n, the provided seed will be incremented every time by this value
     * @minimum 1
     * @maximum 1000
    */
    seed_variation?: number;
    /** Set to True to enable karras noise scheduling tweaks */
    karras?: boolean;
    /** The list of post-processors to apply to the image, in the order to be applied */
    post_processing?: (typeof AIHorde.ModelGenerationInputPostProcessingTypes[keyof typeof AIHorde.ModelGenerationInputPostProcessingTypes])[];
    /**
     * Set to True to create images that stitch together seamlessly
     * @default false
    */
    tiling?: boolean;
    /**
     * Set to True to process the image at base resolution before upscaling and re-processing
     * @default false
    */
    hires_fix?: boolean;
    /**
     * The number of CLIP language processor layers to skip
     * @minimum 1
     * @maximum 12
    */
    clip_skip?: number;
    control_type?: (typeof AIHorde.ModelGenerationInputControlTypes[keyof typeof AIHorde.ModelGenerationInputControlTypes]);
    /** The prompt which will be sent to Stable Diffusion to generate an image */
    prompt?: string;
    /**
     * @default 30
    */
    ddim_steps?: number;
    /**
     * The amount of images to generate
     * @default 1
    */
    n_iter?: number;
    /** When true will apply NSFW censoring model on the generation */
    use_nsfw_censor?: boolean;
}
export interface NoValidRequestFoundKobold extends NoValidRequestFound {
    /** How many waiting requests were skipped because they demanded a higher max_context_length than what this worker provides. */
    max_context_length?: number;
    /** How many waiting requests were skipped because they demanded more generated tokens that what this worker can provide. */
    max_length?: number;
    /** How many waiting requests were skipped because they demanded an available soft-prompt which this worker does not have. */
    matching_softprompt?: number;
}
export interface NoValidRequestFoundStable extends NoValidRequestFound {
    /** How many waiting requests were skipped because they demanded a higher size than this worker provides */
    max_pixels?: number;
}
export interface NoValidRequestFound {
    /** How many waiting requests were skipped because they demanded a specific worker */
    worker_id?: number;
    /** How many waiting requests were skipped because they required higher performance */
    performance?: number;
    /** How many waiting requests were skipped because they demanded a nsfw generation which this worker does not provide */
    nsfw?: number;
    /** How many waiting requests were skipped because they demanded a generation with a word that this worker does not accept */
    blacklist?: number;
    /** How many waiting requests were skipped because they demanded a trusted worker which this worker is not */
    untrusted?: number;
    /** How many waiting requests were skipped because they demanded a different model than what this worker provides */
    models?: number;
    /** How many waiting requests were skipped because they require a higher version of the bridge than this worker is running (upgrade if you see this in your skipped list) */
    bridge_version?: number;
}
export interface GenerationSubmitted {
    /** The amount of kudos gained for submitting this request */
    reward?: number;
}
export interface UserThingUsageRecords {
    /**
     * How many megapixelsteps this user has generated or requested
     * @default 0
     */
    megapixelsteps?: number;
    /**
     * How many tokens this user has generated or requested
     * @default 0
     */
    tokens?: number;
}
export interface UserThingFulfillmentRecords {
    /**
     * How many images were generated or requested
     * @default 0
     */
    image?: number;
    /**
     * How many images were interrogated generated or requested
     * @default 0
     */
    interrogation?: number;
    /**
     * How many texts were generated or requested
     * @default 0
     */
    text?: number;
}
export interface UserRecords {
    usage?: UserThingUsageRecords;
    contribution?: UserThingUsageRecords;
    fulfillment?: UserThingFulfillmentRecords;
    request?: UserThingFulfillmentRecords;
}
export interface UserDetails {
    /** The user's unique Username. It is a combination of their chosen alias plus their ID. */
    username?: string;
    /** The user unique ID. It is always an integer. */
    id?: number;
    /** The amount of Kudos this user has. The amount of Kudos determines the priority when requesting image generations. */
    kudos?: number;
    /** (Privileged) The amount of Evaluating Kudos this untrusted user has from generations and uptime. When this number reaches 50000, they automatically become trusted. */
    evaluating_kudos?: number;
    /** How many concurrent generations this user may request. */
    concurrency?: number;
    /** Whether this user has been invited to join a worker to the horde and how many of them. When 0, this user cannot add (new) workers to the horde. */
    worker_invited?: number;
    /** This user is a Horde moderator. */
    moderator?: boolean;
    kudos_details?: UserKudosDetails;
    /** How many workers this user has created (active or inactive) */
    worker_count?: number;
    worker_ids?: string[];
    monthly_kudos?: MonthlyKudos;
    /** This user is a trusted member of the Horde. */
    trusted?: boolean;
    /** This user has been flagged for suspicious activity. */
    flagged?: boolean;
    /** (Privileged) How much suspicion this user has accumulated */
    suspicious?: number;
    /** If true, this user has not registered using an oauth service. */
    pseudonymous?: boolean;
    /**
     * (Privileged) Contact details for the horde admins to reach the user in case of emergency.
     * @example email@example.com
    */
    contact?: string;
    /**
     * How many seconds since this account was created
     * @example 60
     */
    account_age?: number;
    /**
     * @deprecated
     */
    usage?: UsageDetailsStable;
    /**
     * @deprecated
     */
    contributions?: ContributionsDetailsStable;
    records?: UserRecords;
}
export interface UserKudosDetails {
    /** The ammount of Kudos accumulated or used for generating images. */
    accumulated?: number;
    /** The amount of Kudos this user has given to other users. */
    gifted?: number;
    /** The amount of Kudos this user has been given by the Horde admins. */
    admin?: number;
    /** The amount of Kudos this user has been given by other users. */
    received?: number;
    /** The amount of Kudos this user has received from recurring rewards. */
    recurring?: number;
    /** The amount of Kudos this user has received from rating images. */
    awarded?: number;
}
export interface MonthlyKudos {
    /** How much recurring Kudos this user receives monthly. */
    amount?: number;
    /**
     * Last date this user received monthly Kudos.
     * @type string($date-time)
    */
    last_received?: string;
}
export interface UsageDetailsStable extends UsageDetails {
    /** How many images this user has requested */
    requests?: number;
    /** How many megapixelsteps this user has requested */
    megapixelsteps?: number;
}
export interface UsageDetails {
    /** How many images this user has requested */
    requests?: number;
}
export interface ContributionsDetailsStable extends ContributionsDetails {
    /** How many images this user has generated */
    fulfillments?: number;
    /** How many megapixelsteps this user has generated */
    megapixelsteps?: number;
}
export interface ContributionsDetails {
    /** How many images this user has generated */
    fulfillments?: number;
}
export interface ModifyUser {
    /** The new total Kudos this user has after this request */
    new_kudos?: number;
    /** The request concurrency this user has after this request */
    concurrency?: number;
    /** Multiplies the amount of kudos lost when generating images. */
    usage_multiplier?: number;
    /** This userWhether this user has been invited to join a worker to the horde and how many of them. When 0, this user cannot add (new) workers to the horde. */
    worker_invited?: number;
    /** The user's new moderator status. */
    moderator?: boolean;
    /** The user's new public_workers status. */
    public_workers?: number;
    /** The user's new username. */
    username?: string;
    /** The user's new monthly kudos total */
    monthly_kudos?: number;
    /** The user's new trusted status */
    trusted?: boolean;
}
export interface WorkersPerformanceFilter {
    /**
     * Minimal value of performance for worker to have
     * @default 1.5
     */
    performance?: number;
    /**
     * Minimal filtered workers amount to resort to the list of first `minLength` workers sorted by `performance` value
     * @default 5
     */
    size?: number;
    /**
     * Worker should support img2img
     */
    img2img?: boolean;
    /**
     * List of models workers should have (at least one)
     */
    models?: string[];
}
export interface WorkerDetailsStable extends WorkerDetails {
    /** The maximum pixels in resolution this workr can generate */
    max_pixels?: number;
    /** How many megapixelsteps this worker has generated until now */
    megapixelsteps_generated?: number;
    /** If True, this worker supports and allows img2img requests. */
    img2img?: boolean;
    /** If True, this worker supports and allows inpainting requests. */
    painting?: boolean;
    /** If True, this worker supports and allows post-processing requests. */
    "post-processing"?: boolean;
}
export interface WorkerDetails extends WorkerDetailsLite {
    /** How many images this worker has generated. */
    requests_fulfilled?: number;
    /** How many Kudos this worker has been rewarded in total. */
    kudos_rewards?: number;
    kudos_details?: WorkerKudosDetails;
    /** The average performance of this worker in human readable form. */
    performance?: string;
    /** How many threads this worker is running. */
    threads?: number;
    /** The amount of seconds this worker has been online for this Horde. */
    uptime?: number;
    /** When True, this worker will not pick up any new requests */
    maintenance_mode?: boolean;
    /** (Privileged) When True, this worker not be given any new requests. */
    paused?: boolean;
    /** Extra information or comments about this worker provided by its owner. */
    info?: string;
    /** Whether this worker can generate NSFW requests or not. */
    nsfw?: boolean;
    /** Privileged or public if the owner has allowed it. The alias of the owner of this worker. */
    owner?: string;
    /** The worker is trusted to return valid generations. */
    trusted?: boolean;
    /** (Privileged) How much suspicion this worker has accumulated */
    suspicious?: number;
    /**
     * How many jobs this worker has left uncompleted after it started them.
     * @example 0
    */
    uncompleted_jobs?: number;
    /** Which models this worker if offerring */
    models?: string[];
    team?: TeamDetailsLite;
    /**
     * (Privileged) Contact details for the horde admins to reach the owner of this worker in emergencies.
     * @example email@example.com
     * @minLength 5
     * @maxLength 500
    */
    contact?: string;
    /**
     * The bridge agent name, version and website
     * @default: unknown:0:unknown
     * @example: AI Horde Worker:11:https://github.com/db0/AI-Horde-Worker
     * @maxLength: 1000
    */
    bridge_agent?: string;
}
export interface WorkerDetailsLite {
    /** The Name given to this worker. */
    name?: string;
    /** The UUID of this worker. */
    id?: string;
    /** True if the worker has checked-in the past 5 minutes. */
    online?: boolean;
}
export interface WorkerKudosDetails {
    /** How much Kudos this worker has received for generating images */
    generated?: number;
    /** How much Kudos this worker has received for staying online longer */
    uptime?: number;
}
export interface ModifyWorker {
    /** The new state of the 'maintenance' var for this worker. When True, this worker will not pick up any new requests. */
    maintenance?: boolean;
    /** The new state of the 'paused' var for this worker. When True, this worker will not be given any new requests. */
    paused?: boolean;
    /** The new state of the 'info' var for this worker. */
    info?: string;
    /** The new name for this this worker. */
    name?: string;
}
export interface DeletedWorker {
    /** The ID of the deleted worker */
    deleted_id?: string;
    /** The Name of the deleted worker*/
    deleted_name?: string;
}
export interface ActiveModel extends ActiveModelLite {
    /** The average speed of generation for this model */
    performance?: number;
    /** The amount waiting to be generated by this model */
    queued?: number;
    /** Estimated time in seconds for this model's queue to be cleared */
    eta?: number;
}
export interface ActiveModelLite {
    /** The name of a model available by workers in this horde. */
    name?: string;
    /** How many workers in this horde are running this model. */
    count?: number;
}
export interface KudosTransferred {
    /** The amount of Kudos tranferred */
    transferred?: number;
}
export interface HordeModes {
    /** When True, this Horde will not accept new requests for image generation, but will finish processing the ones currently in the queue. */
    maintenance_mode?: boolean;
    /** When True, this Horde will not only accept worker explicitly invited to join. */
    invite_only_mode?: boolean;
    /** When True, this Horde will not always provide full information in order to throw off attackers. */
    raid_mode?: boolean;
}
export interface HordePerformanceStable extends HordePerformance {
    /** The amount of megapixelsteps in waiting and processing requests currently in this Horde */
    queued_megapixelsteps?: number;
    /** How many megapixelsteps this Horde generated in the last minute */
    past_minute_megapixelsteps?: number;
    /** The amount of image interrogations waiting and processing currently in this Horde */
    queued_forms?: number;
    /** How many workers are actively processing image interrogations in this Horde in the past 5 minutes */
    interrogator_count?: number;
    /** How many worker threads are actively processing image interrogation in this Horde in the past 5 minutes */
    interrogator_thread_count?: number;
}
export interface HordePerformance {
    /** The amount of waiting and processing requests currently in this Horde */
    queued_requests?: number;
    /** How many workers are actively processing image generations in this Horde in the past 5 minutes */
    worker_count?: number;
    /** How many worker threads are actively processing prompt generations in this Horde in the past 5 minutes */
    thread_count?: number;
}
export interface Newspiece {
    /** The date this newspiece was published */
    date_published?: string;
    /** The actual piece of news */
    newspiece?: string;
    /** How critical this piece of news is. */
    importance?: string;
}
export interface CreateTeamInput {
    /**
     * The name of the team. No profanity allowed!
     * @minLength 3
     * @maxLength 100
    */
    name: string;
    /**
     * Extra information or comments about this team.
     * @example Anarchy is emergent order.
     * @minLength 3
     * @maxLength 1000
    */
    info?: string;
}
export interface ModifyTeam {
    /** The ID of the team */
    id?: string;
    /** The Name of the team */
    name?: string;
    /** The Info of the team */
    info?: string;
}
export interface TeamDetailsStable extends TeamDetails {
    /** How many megapixelsteps the workers in this team have been rewarded while part of this team. */
    contributions?: number;
    /** The average performance of the workers in this team, in megapixelsteps per second. */
    performance?: number;
    /** The total expected speed of this team when all workers are working in parallel, in megapixelsteps per second. */
    speed?: number;
}
export interface TeamDetails extends TeamDetailsLite {
    /**
     * Extra information or comments about this team provided by its owner
     * @example Anarchy is emergent order.
    */
    info?: string;
    /** How many images this team's workers have generated */
    requests_fulfilled?: number;
    /** How many Kudos the workers in this team have been rewarded while part of this team. */
    kudos?: number;
    /** The total amount of time workers have stayed online while on this team */
    uptime?: number;
    /**
     * How many workers have been dedicated to this team
     * @example 10
    */
    worker_count?: number;
    workers?: WorkerDetailsLite[];
    models?: ActiveModelLite[];
}
export interface TeamDetailsLite {
    /** The Name given to this team. */
    name?: string;
    /** The UUID of this team */
    id?: string;
}
export interface ModifyTeamInput {
    /**
     * The name of the team. No profanity allowed!
     * @minLength 3
     * @maxLength 100
    */
    name?: string;
    /**
     * Extra information or comments about this team.
     * @example Anarchy is emergent order.
     * @minLength 3
     * @maxLength 1000
    */
    info?: string;
}
export interface DeletedTeam {
    /** The ID of the deleted team */
    deleted_id?: string;
    /** The Name of the deleted team */
    deleted_name?: string;
}
export interface DeleteTimeoutIPInput {
    /**
     * The IP address to remove from timeout
     * @example 127.0.0.1
     * @minLength 7
     * @maxLength 15
     */
    ipaddr: string;
}
export interface SimpleResponse {
    /**
     * The result of this operation
     * @default OK
     */
    message: string;
}
export declare type InterrogationPopFormPayloadStable = Partial<Record<typeof AIHorde.ModelInterrogationFormTypes[keyof typeof AIHorde.ModelInterrogationFormTypes], string>>;
export declare type InterrogationFormResult = Partial<Record<typeof AIHorde.ModelInterrogationFormTypes[keyof typeof AIHorde.ModelInterrogationFormTypes], Record<string, any>>>;
export interface ModelInterrogationFormStable {
    /**
     * The type of interrogation this is
     */
    name: typeof AIHorde.ModelInterrogationFormTypes[keyof typeof AIHorde.ModelInterrogationFormTypes];
    payload?: InterrogationPopFormPayload;
}
export interface ModelInterrogationInputStable {
    forms: ModelInterrogationFormStable[];
    /** The public URL of the image to interrogate */
    source_image: string;
}
export interface RequestInterrogationResponse {
    /** The UUID of the request. Use this to retrieve the request status in the future */
    id?: string;
    /** Any extra information from the horde about this request */
    message?: string;
}
export interface InterrogationPopInput {
    /** The Name of the Worker */
    name?: string;
    /** Users with priority to use this worker */
    priority_usernames?: string[];
    /** The type of interrogation this worker can fulfull */
    forms?: (typeof AIHorde.ModelInterrogationFormTypes[keyof typeof AIHorde.ModelInterrogationFormTypes])[];
    /**
     * The amount of forms to pop at the same time
     * @default 1
     */
    amount?: number;
    /**
     * The version of the bridge used by this worker
     * @default 1
     */
    bridge_version?: number;
    /**
     * How many threads this worker is running. This is used to accurately estimate the power available in the horde.
     * @default 1
     * @minimum 1
     * @maximum 10
     */
    threads?: number;
}
export interface InterrogationPopFormPayload {
    /** The UUID of the interrogation form. Use this to post the results in the future  */
    id?: string;
    /**
     * The name of this interrogation form
     * @example caption
     */
    name?: typeof AIHorde.ModelInterrogationFormTypes[keyof typeof AIHorde.ModelInterrogationFormTypes];
    payload?: InterrogationPopFormPayloadStable;
    /** The URL From which the source image can be downloaded */
    source_image?: string;
}
export interface NoValidInterrogationsFound {
    /**
     * How many waiting requests were skipped because they demanded a specific worker.
     * @minimum 0
     */
    worker_id?: number;
    /**
     * How many waiting requests were skipped because they demanded a trusted worker which this worker is not.
     * @minimum 0
     */
    untrusted?: number;
    /**
     * How many waiting requests were skipped because they require a higher version of the bridge than this worker is running (upgrade if you see this in your skipped list).
     * @example 0
     * @minimum 0
     */
    bridge_version?: number;
}
export interface InterrogationPopPayload {
    forms: InterrogationPopFormPayload;
    skipped?: NoValidInterrogationsFound;
}
export interface InterrogationFormStatus {
    /** The name of this interrogation form */
    form?: string;
    /** title: Interrogation State */
    state?: typeof AIHorde.HordeAsyncRequestStates[keyof typeof AIHorde.HordeAsyncRequestStates];
    result?: InterrogationFormResult;
}
export interface InterrogationStatus {
    /** title: Interrogation State */
    state?: typeof AIHorde.HordeAsyncRequestStates[keyof typeof AIHorde.HordeAsyncRequestStates];
    forms?: InterrogationFormStatus[];
}
export interface AestheticsPayload {
    /**
     * The UUID of the best image in this generation batch (only used when 2+ images generated). If 2+ aesthetic ratings are also provided, then they take precedence if they're not tied.
     * @example 6038971e-f0b0-4fdd-a3bb-148f561f815e
     * @minLength 36
     * @maxLength 36
     */
    best?: string;
    /**
     * The team towards which this ratings contributes. It not is passed, it will leave the ratings without a team.
     * @example 0bed257b-e57c-4327-ac64-40cdfb1ac5e6
     * @minLength 36
     * @maxLength 36
     */
    team?: string;
    ratings?: AestheticRating[];
}
export interface AestheticRating {
    /**
     * The UUID of image being rated
     * @example 6038971e-f0b0-4fdd-a3bb-148f561f815e
     * @minLength 36
     * @maxLength 36
     */
    id: string;
    /**
     * The aesthetic rating 1-10 for this image
     * @minimum 1
     * @maximum 10
     */
    rating: number;
}
export interface FilterCheckPayload {
    prompt: string;
}
export interface FilterPromptSuspicion {
    /** Rates how suspicious the provided prompt is. A suspicion of 2 means it would be blocked. */
    suspicion: string;
    matches: string[];
}
export interface FilterDetails {
    /** The UUID of this filter */
    id: string;
    /**
     * The regex for this filter.
     * @example ac.*
     */
    regex: string;
    /**
     * The integer defining this filter type
     * @minimum 10
     * @maximum 29
     */
    filter_type: number;
    /**
     * Description about this regex
     */
    description?: string;
    /**
     * The moderator which added or last updated this regex
     */
    user: string;
}
export interface PatchExistingFilter {
    /**
     * The regex for this filter.
     * @example ac.*
     */
    regex?: string;
    /**
     * The integer defining this filter type
     * @minimum 10
     * @maximum 29
     */
    filter_type?: number;
    /**
     * Description about this regex
     */
    description?: string;
}
export interface PutNewFilter {
    /**
     * The regex for this filter.
     * @example ac.*
     */
    regex: string;
    /**
     * The integer defining this filter type
     * @minimum 10
     * @maximum 29
     */
    filter_type: number;
    /**
     * Description about this regex
     */
    description: string;
}
export interface ImageModelStats {
    day?: SinglePeriodImageModelStats;
    month?: SinglePeriodImageModelStats;
    total?: SinglePeriodImageModelStats;
}
/**
 * string - Model Name
 * number - The amount of requests fulfilled for this model
 */
export declare type SinglePeriodImageModelStats = Record<string, number>;
export interface ImageTotalStats {
    minute?: SinglePeriodImageStats;
    hour?: SinglePeriodImageStats;
    day?: SinglePeriodImageStats;
    month?: SinglePeriodImageStats;
    total?: SinglePeriodImageStats;
}
export interface SinglePeriodImageStats {
    /** The amount of text requests generated during this period. */
    requests?: number;
    /** The amount of tokens generated during this period. */
    tokens?: number;
}
export interface TextModelStats {
    day?: SinglePeriodTextModelStats;
    month?: SinglePeriodTextModelStats;
    total?: SinglePeriodTextModelStats;
}
/**
 * string - Model Name
 * number - The amount of requests fulfilled for this model
 */
export declare type SinglePeriodTextModelStats = Record<string, number>;
export interface TextTotalStats {
    minute?: SinglePeriodTextStats;
    hour?: SinglePeriodTextStats;
    day?: SinglePeriodTextStats;
    month?: SinglePeriodTextStats;
    total?: SinglePeriodTextStats;
}
export interface SinglePeriodTextStats {
    /** The amount of text requests generated during this period. */
    requests?: number;
    /** The amount of tokens generated during this period. */
    tokens?: number;
}
/**
 * AI Horde Ratings
 */
declare enum RatingArtifactsRatings {
    "FLAWLESS" = 0,
    "LITTLE_FLAWS" = 1,
    "SOME_FLAWS" = 2,
    "OBVIOUS_FLAWS" = 3,
    "HARMFUL_FLAWS" = 4,
    "GARBAGE" = 5
}
declare class AIHordeRatings {
    #private;
    static readonly RatingArtifactsRatings: typeof RatingArtifactsRatings;
    readonly RatingArtifactsRatings: typeof RatingArtifactsRatings;
    static readonly APIError: typeof APIError;
    readonly APIError: typeof APIError;
    constructor(options: AIHordeRatingsInitOptions);
    /**
     * Display all datasets
     * @param options.fields - Array of fields that will be included in the returned data
     * @returns RatingsDatasetResponse - The datasets
     */
    getDatasets<T extends keyof DatasetGetResponse>(options?: {
        fields?: T[];
    }): Promise<Pick<DatasetGetResponse, T>[]>;
    /**
     * Display all public teams
     * @param options.fields - Array of fields that will be included in the returned data
     * @returns RatingsTeamsResponse - The datasets
     */
    getTeams<T extends keyof TeamsGetResponse>(options?: {
        fields?: T[];
    }): Promise<Pick<TeamsGetResponse, T>[]>;
    /**
     * Retrieve an image to rate from the default dataset
     * @param image_options.dataset_id - The ID of the dataset to get an image from
     * @param image_options.model_name - The model name to get an image from
     * @param options.token - The token of the requesting user
     * @param options.fields - Array of fields that will be included in the returned data
     * @returns DatasetImagePopResponse - An images data to rate
     */
    getNewRating<T extends keyof DatasetImagePopResponse>(image_options?: {
        dataset_id: string;
        model_name?: string;
    }, options?: {
        token?: string;
        fields?: T[];
    }): Promise<Pick<DatasetImagePopResponse, T>>;
    /** POST ENDPOINTS */
    /**
     * Check if there are interrogation requests queued for fulfillment
     * This endpoint is used by registered workers only
     * @param image_id - The ID if the Image you want to rate
     * @param rating
     * @param options.token - The token of the requesting user
     * @param options.fields - Array of fields that will be included in the returned data
     * @returns InterrogationPopPayload
     */
    postRating<T extends keyof RatePostResponse>(image_id: string, rating: RatePostInput, options?: {
        token?: string;
        fields?: T[];
    }): Promise<Pick<RatePostResponse, T>>;
}
/**
 * Internal Interfaces
 */
export interface AIHordeRatingsInitOptions {
    /** The default token to use for requests */
    default_token?: string;
    /** The base api domain + route to use for requests */
    api_route?: string;
    /** The client agent to pass in the requests. */
    client_agent: string;
}
/**
 * API Interfaces
 */
export interface DatasetGetResponse {
    /**
     * The unique identifier for this dataset
     * @example 00000000-0000-0000-0000-000000000000
     */
    id?: string;
    /**
     * The name of this dataset
     * @example My Dataset
     */
    name?: string;
    /**
     * The description of this dataset
     * @example This is a dataset of images of cats
     */
    description?: string;
    /**
     * The number of images in this dataset
     * @example 100
     */
    image_count?: number;
}
export interface TeamsGetResponse {
    /**
     * The unique identifier for this team
     * @example 00000000-0000-0000-0000-000000000000
     */
    id?: string;
    /**
     * The name of this team
     * @example My Team
     */
    team_name?: string;
    /**
     * Whether this team is private or not
     * @example false
     */
    is_private?: boolean;
}
export interface DatasetImagePopResponse {
    /**
     * The UUID of the image to rate
     * @example 00000000-0000-0000-0000-000000000000
     */
    id?: string;
    /**
     * The URL from which to download the image
     * @example https://cdn.droom.cloud/00000000-0000-0000-0000-000000000000.webp
     */
    url?: string;
    /**
     * The UUID of the dataset in which this image belongs
     * @example 00000000-0000-0000-0000-000000000000
     */
    dataset_id?: string;
}
export interface RatingRequestError {
    /** The error message for this status code. */
    message: string;
}
export interface RatePostInput {
    /**
     * The aesthetic rating for this image. How much do you like this image subjectively and in isolation from comparison with other images or with its own prompt.
     * @example 5
     * @minimum 1
     * @maximum 10
     */
    rating: number;
    /**
     * The artifacts rating for this image.
     * 0 for flawless generation that perfectly fits to the prompt.
     * 1 for small, hardly recognizable flaws.
     * 2 small flaws that can easily be spotted, but don not harm the aesthetic experience.
     * 3 for flaws that look obviously wrong, but only mildly harm the aesthetic experience.
     * 4 for flaws that look obviously wrong & significantly harm the aesthetic experience.
     * 5 for flaws that make the image look like total garbage
     * @example 1
     * @minimum 0
     * @maximum 5
     */
    artifacts?: typeof AIHordeRatings.RatingArtifactsRatings[keyof typeof AIHordeRatings.RatingArtifactsRatings];
}
export interface RatePostResponse {
    /**
     * The amount of kudos awarded for this rating
     * @example 5
     * @minimum 1
     */
    reward: number;
    /**
     * Any extra information about the submitted rating
     * @example Rating submitted
     */
    message: string;
}
