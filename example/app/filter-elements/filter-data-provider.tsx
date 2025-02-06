import type React from "react";
import { createContext, useCallback, useContext, useMemo, useState } from "react";

export interface CardItem {
    id: string;
    isExpanded: boolean;
}

const DataContext = createContext({
    data: [] as CardItem[],
    setExpanded: (id: string, expanded: boolean) => {},
    filter: '',
    setFilter: null as unknown as React.Dispatch<React.SetStateAction<string>>
});

export const CardsDataProvider = ({
    initialData,
    children,
}: { initialData: CardItem[]; children: React.ReactNode }) => {
    const [data, setData] = useState(initialData);
    const [filter, setFilter] = useState("");

    const setExpanded = useCallback((id: string, expanded: boolean) => {
        setData((prevData) => {
            return prevData.map((item) => {
                if (item.id === id) {
                    return { ...item, isExpanded: expanded };
                }
                return item;
            });
        });
    }, []);

    const filteredData = useMemo(() => {
        if (filter !== "") {
            const filterLower = filter.toLowerCase();
            return data.filter((item) => item.id.includes(filterLower));
        }
        return data;
    }, [filter, data]);

    return <DataContext.Provider value={{ data: filteredData, setExpanded, filter, setFilter }}>{children}</DataContext.Provider>;
};

export const useCardData = () => {
    const contextValue = useContext(DataContext);
    if (!contextValue) {
        throw new Error("useData must be used within a CardDataProvider");
    }
    return contextValue;
};
