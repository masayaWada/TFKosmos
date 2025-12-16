interface ErrorMessageProps {
  message: string;
  onClose?: () => void;
}

export default function ErrorMessage({ message, onClose }: ErrorMessageProps) {
  // メッセージに改行が含まれている場合は、複数行で表示
  const lines = message.split("\n");

  return (
    <div
      style={{
        padding: "1rem",
        backgroundColor: "#f8d7da",
        color: "#721c24",
        border: "1px solid #f5c6cb",
        borderRadius: "4px",
        marginBottom: "1rem",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
      }}
    >
      <div style={{ flex: 1 }}>
        {lines.map((line, index) => (
          <div
            key={index}
            style={{ marginBottom: index < lines.length - 1 ? "0.5rem" : 0 }}
          >
            {line}
          </div>
        ))}
      </div>
      {onClose && (
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            color: "#721c24",
            cursor: "pointer",
            fontSize: "1.2rem",
            padding: "0 0.5rem",
            marginLeft: "1rem",
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}
