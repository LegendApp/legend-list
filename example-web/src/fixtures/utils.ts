import React from "react";

export type Country = { id: string; name: string; flag: string };
export type SimpleItem = { id: string };

export const generateItems = (count: number, startIndex = 0): SimpleItem[] =>
    Array.from({ length: count }, (_, i) => ({ id: String(startIndex + i) }));

export const useCountries = () => {
    const [countriesData, setCountriesData] = React.useState<Country[]>([]);

    const load = React.useCallback(async () => {
        try {
            const mod = await import("countries-list");
            const countries = mod.countries as Record<string, { name: string }>;
            const getEmojiFlag = (mod as any).getEmojiFlag as (code: string) => string;
            const data: Country[] = Object.entries(countries)
                .map(([code, country]) => ({ flag: getEmojiFlag(code), id: code, name: country.name }))
                .sort((a, b) => a.name.localeCompare(b.name));
            setCountriesData(data);
        } catch (_e) {
            const fallback: Country[] = [
                { flag: "🇺🇸", id: "US", name: "United States" },
                { flag: "🇬🇧", id: "GB", name: "United Kingdom" },
                { flag: "🇯🇵", id: "JP", name: "Japan" },
                { flag: "🇫🇷", id: "FR", name: "France" },
                { flag: "🇩🇪", id: "DE", name: "Germany" },
                { flag: "🇮🇳", id: "IN", name: "India" },
            ].sort((a, b) => a.name.localeCompare(b.name));
            setCountriesData(fallback);
        }
    }, []);

    return { countriesData, load };
};
