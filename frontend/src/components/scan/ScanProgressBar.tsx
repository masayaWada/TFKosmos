import { formStyles } from "../../styles/formStyles";
import LoadingSpinner from "../common/LoadingSpinner";

interface ScanProgressBarProps {
  progress: number;
  message: string;
}

export default function ScanProgressBar({
  progress,
  message,
}: ScanProgressBarProps) {
  return (
    <div style={{ marginTop: "1rem" }}>
      <div style={formStyles.progressBar}>
        <div
          style={{
            ...formStyles.progressFill,
            width: `${progress}%`,
          }}
        >
          {progress > 10 ? `${progress}%` : ""}
        </div>
      </div>
      <div style={formStyles.progressMessage}>
        {message || "スキャン中..."}
      </div>
      {progress < 100 && (
        <div style={{ textAlign: "center", marginTop: "0.5rem" }}>
          <LoadingSpinner />
        </div>
      )}
    </div>
  );
}
