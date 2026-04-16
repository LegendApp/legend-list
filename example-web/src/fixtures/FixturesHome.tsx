import { FIXTURE_GROUPS, FIXTURE_ROUTES } from "./routes";

export default function FixturesHome() {
    return (
        <div className="flex flex-col gap-6">
            {FIXTURE_GROUPS.map((group) => (
                <section key={group}>
                    <h2 className="mb-3 text-sm uppercase text-[#334155]">{group}</h2>
                    <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
                        {FIXTURE_ROUTES.filter((route) => route.group === group).map((route) => (
                            <a
                                className="block rounded-2xl border border-[#d7dce5] bg-white p-4 text-[#0f172a] no-underline"
                                href={`/${route.path}`}
                                key={route.path}
                            >
                                <div className="text-base font-bold">{route.title}</div>
                                <div className="mt-2 text-sm leading-6 text-[#475569]">{route.description}</div>
                            </a>
                        ))}
                    </div>
                </section>
            ))}
        </div>
    );
}
