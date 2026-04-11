import { createSeededRandom, pickOne } from "./random";

const firstNames = [
    "Avery",
    "Cameron",
    "Devon",
    "Emerson",
    "Finley",
    "Harper",
    "Jordan",
    "Kai",
    "Logan",
    "Morgan",
    "Noah",
    "Parker",
    "Quinn",
    "Riley",
    "Sawyer",
    "Skyler",
    "Taylor",
] as const;

const lastNames = [
    "Allen",
    "Brooks",
    "Chen",
    "Diaz",
    "Foster",
    "Hughes",
    "Lee",
    "Nguyen",
    "Patel",
    "Rivera",
    "Simmons",
    "Turner",
    "Walker",
    "Young",
] as const;
const departments = ["Design", "Engineering", "Growth", "Operations", "Product", "Support", "Research", "Sales"] as const;
const cities = ["Austin", "Berlin", "Chicago", "Lisbon", "Seoul", "Tokyo", "Toronto", "Melbourne"] as const;
const accents = ["#F4A261", "#84A59D", "#6D597A", "#3D5A80", "#E76F51", "#2A9D8F"] as const;

export type DirectoryPerson = {
    accent: string;
    city: string;
    department: string;
    id: string;
    initials: string;
    name: string;
    title: string;
};

export function buildDirectoryPeople(count = 240) {
    const random = createSeededRandom(48);

    return Array.from({ length: count }, (_, index) => {
        const first = pickOne(firstNames, random);
        const last = pickOne(lastNames, random);
        const department = pickOne(departments, random);
        const city = pickOne(cities, random);
        const accent = pickOne(accents, random);
        const name = `${first} ${last}`;

        return {
            accent,
            city,
            department,
            id: `person-${index + 1}`,
            initials: `${first[0]}${last[0]}`,
            name,
            title: `${department} Lead`,
        } satisfies DirectoryPerson;
    }).sort((a, b) => a.name.localeCompare(b.name));
}

export type SectionedDirectoryRow =
    | {
          id: string;
          title: string;
          type: "header";
      }
    | (DirectoryPerson & {
          type: "person";
      });

export function buildSectionedDirectoryRows(people: DirectoryPerson[]) {
    const rows: SectionedDirectoryRow[] = [];
    const stickyHeaderIndices: number[] = [];
    let currentLetter = "";

    for (const person of people) {
        const letter = person.name[0]!.toUpperCase();
        if (letter !== currentLetter) {
            stickyHeaderIndices.push(rows.length);
            rows.push({
                id: `header-${letter}`,
                title: letter,
                type: "header",
            });
            currentLetter = letter;
        }

        rows.push({
            ...person,
            type: "person",
        });
    }

    return { rows, stickyHeaderIndices };
}
