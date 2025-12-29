import { useNotifications } from "../../context/AppContext";

const notificationStyles = {
  container: {
    position: "fixed" as const,
    top: "1rem",
    right: "1rem",
    zIndex: 1000,
    display: "flex",
    flexDirection: "column" as const,
    gap: "0.5rem",
    maxWidth: "400px",
  },
  notification: {
    padding: "1rem",
    borderRadius: "4px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
    animation: "slideIn 0.3s ease-out",
  },
  error: {
    backgroundColor: "#f8d7da",
    color: "#721c24",
    border: "1px solid #f5c6cb",
  },
  success: {
    backgroundColor: "#d4edda",
    color: "#155724",
    border: "1px solid #c3e6cb",
  },
  warning: {
    backgroundColor: "#fff3cd",
    color: "#856404",
    border: "1px solid #ffeeba",
  },
  info: {
    backgroundColor: "#d1ecf1",
    color: "#0c5460",
    border: "1px solid #bee5eb",
  },
  message: {
    flex: 1,
    marginRight: "1rem",
    wordBreak: "break-word" as const,
  },
  closeButton: {
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: "1.2rem",
    padding: 0,
    lineHeight: 1,
    opacity: 0.7,
  },
};

export default function NotificationContainer() {
  const { notifications, removeNotification } = useNotifications();

  if (notifications.length === 0) {
    return null;
  }

  return (
    <>
      <style>
        {`
          @keyframes slideIn {
            from {
              transform: translateX(100%);
              opacity: 0;
            }
            to {
              transform: translateX(0);
              opacity: 1;
            }
          }
        `}
      </style>
      <div style={notificationStyles.container}>
        {notifications.map((notification) => (
          <div
            key={notification.id}
            style={{
              ...notificationStyles.notification,
              ...notificationStyles[notification.type],
            }}
          >
            <span style={notificationStyles.message}>{notification.message}</span>
            <button
              style={{
                ...notificationStyles.closeButton,
                color:
                  notification.type === "error"
                    ? "#721c24"
                    : notification.type === "success"
                    ? "#155724"
                    : notification.type === "warning"
                    ? "#856404"
                    : "#0c5460",
              }}
              onClick={() => removeNotification(notification.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
