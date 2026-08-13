import type { ReactNode } from "react";
import { Wallet } from "@phosphor-icons/react/dist/ssr";
import styles from "./Shell.module.css";

type Props = {
  width?: "narrow" | "default" | "xwide";
  children: ReactNode;
};

/**
 * The one page shell every screen uses. No nav, no chrome — just a quiet
 * wordmark and the screen's content. Three screens is the whole app; this
 * keeps it feeling that small (see PRODUCT.md: "One user, no chrome for others").
 */
export default function Shell({ width = "default", children }: Props) {
  return (
    <main className={styles.main}>
      <div className={styles.wordmark}>
        <Wallet size={16} weight="bold" aria-hidden />
        <span>Add2Wallet</span>
      </div>
      <div className={`${styles.content} ${styles[width]}`}>{children}</div>
    </main>
  );
}
