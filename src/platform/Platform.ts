export const Platform = {
    isTesting: false,
    isTV: false,
    OS: "web" as const,
    select: <T>(specifics: { web?: T; default?: T } & { [platform: string]: T }): T => {
        return specifics.web ?? specifics.default!;
    },
    Version: 0,
};
