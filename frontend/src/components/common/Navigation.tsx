import { Link, useLocation } from "react-router-dom";

export default function Navigation() {
  const location = useLocation();

  const navItems = [
    { path: "/connection", label: "接続設定" },
    { path: "/scan", label: "スキャン" },
    { path: "/templates", label: "テンプレート" },
  ];

  return (
    <nav
      style={{
        width: "200px",
        backgroundColor: "#f5f5f5",
        padding: "1rem",
        borderRight: "1px solid #ddd",
      }}
    >
      <div style={{ marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <img 
          src="/icon.png" 
          alt="TFKosmos" 
          style={{ width: "32px", height: "32px" }}
        />
        <h2 style={{ margin: 0 }}>TFKosmos</h2>
      </div>
      <ul style={{ listStyle: "none" }}>
        {navItems.map((item) => (
          <li key={item.path} style={{ marginBottom: "0.5rem" }}>
            <Link
              to={item.path}
              style={{
                display: "block",
                padding: "0.5rem",
                textDecoration: "none",
                color: location.pathname === item.path ? "#007bff" : "#333",
                backgroundColor:
                  location.pathname === item.path ? "#e7f3ff" : "transparent",
                borderRadius: "4px",
              }}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
