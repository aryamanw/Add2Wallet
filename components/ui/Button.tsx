import type { ButtonHTMLAttributes } from "react";
import styles from "./Button.module.css";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost";
};

/** The one button shape used across the app. Primary carries the accent; ghost is for secondary actions like "Back". */
export default function Button({ variant = "primary", className, ...props }: Props) {
  const variantClass = variant === "primary" ? styles.primary : styles.ghost;
  return <button className={[styles.button, variantClass, className].filter(Boolean).join(" ")} {...props} />;
}
