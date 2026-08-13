import type { ReactNode } from "react";
import { WarningCircle } from "@phosphor-icons/react/dist/ssr";
import styles from "./StatusMessage.module.css";

type Props = {
  children: ReactNode;
  details?: ReactNode;
};

/** Error banner. Meaning is carried by icon + text together, never by color alone. */
export default function StatusMessage({ children, details }: Props) {
  return (
    <div className={styles.error} role="alert">
      <div className={styles.header}>
        <WarningCircle size={18} weight="fill" aria-hidden />
        <p>{children}</p>
      </div>
      {details && <div className={styles.details}>{details}</div>}
    </div>
  );
}
