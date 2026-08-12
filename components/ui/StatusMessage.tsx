import type { ReactNode } from "react";
import { WarningCircle, CheckCircle } from "@phosphor-icons/react/dist/ssr";
import styles from "./StatusMessage.module.css";

type Props = {
  variant: "error" | "success";
  children: ReactNode;
  details?: ReactNode;
};

/** Error/success banner. Meaning is carried by icon + text together, never by color alone. */
export default function StatusMessage({ variant, children, details }: Props) {
  const Icon = variant === "error" ? WarningCircle : CheckCircle;
  return (
    <div className={variant === "error" ? styles.error : styles.success} role={variant === "error" ? "alert" : "status"}>
      <div className={styles.header}>
        <Icon size={18} weight="fill" aria-hidden />
        <p>{children}</p>
      </div>
      {details && <div className={styles.details}>{details}</div>}
    </div>
  );
}
