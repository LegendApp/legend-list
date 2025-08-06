export const Platform = {
    OS: "web" as const,
    select: <T>(specifics: { web?: T; default?: T } & { [platform: string]: T }): T => {
        return specifics.web ?? specifics.default!;
    },
    Version: 0,
    isTesting: false,
    isTV: false,
};