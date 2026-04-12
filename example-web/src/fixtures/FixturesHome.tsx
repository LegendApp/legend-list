import { FIXTURE_GROUPS, FIXTURE_ROUTES } from "./routes";

export default function FixturesHome() {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div
                style={{
                    background: "#0f172a",
                    borderRadius: 24,
                    color: "#fff",
                    padding: 24,
                }}
            >
                <h1 style={{ fontSize: 32, margin: 0 }}>Legend List Fixtures</h1>
                <p style={{ color: "#cbd5e1", marginBottom: 0 }}>
                    Internal validation surfaces grouped by behavior area.
                </p>
            </div>
            {FIXTURE_GROUPS.map((group) => (
                <section key={group}>
                    <h2 style={{ color: "#334155", fontSize: 14, marginBottom: 12, textTransform: "uppercase" }}>
                        {group}
                    </h2>
                    <div
                        style={{
                            display: "grid",
                            gap: 12,
                            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                        }}
                    >
                        {FIXTURE_ROUTES.filter((route) => route.group === group).map((route) => (
                            <a
                                href={`/${route.path}`}
                                key={route.path}
                                style={{
                                    background: "#fff",
                                    border: "1px solid #d7dce5",
                                    borderRadius: 18,
                                    color: "#0f172a",
                                    display: "block",
                                    padding: 16,
                                    textDecoration: "none",
                                }}
                            >
                                <div style={{ fontSize: 16, fontWeight: 700 }}>{route.title}</div>
                                <div style={{ color: "#475569", fontSize: 14, lineHeight: 1.5, marginTop: 8 }}>
                                    {route.description}
                                </div>
                            </a>
                        ))}
                    </div>
                </section>
            ))}
        </div>
    );
}
