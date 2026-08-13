import type { ReactNode } from "react";
import styles from "./Field.module.css";

type Props = {
  label: string;
  htmlFor: string;
  hint?: string;
  children: ReactNode;
};

/** Label-above-input wrapper. Every form field in the app goes through this so the pattern never drifts. */
export default function Field({ label, htmlFor, hint, children }: Props) {
  return (
    <div className={styles.field}>
      <label htmlFor={htmlFor} className={styles.label}>
        {label}
      </label>
      {children}
      {hint && <p className={styles.hint}>{hint}</p>}
    </div>
  );
}
