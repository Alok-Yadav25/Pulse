import { ArrowUpRight, Github } from "lucide-react";
import "./creator-credit.css";

export default function CreatorCredit() {
  return (
    <a
      className="creator-credit"
      href="https://github.com/Alok-Yadav25"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Made by Alok Yadav — GitHub profile (opens in a new tab)"
    >
      <Github size={14} strokeWidth={1.7} aria-hidden="true" />
      <span>
        Made by <strong>Alok Yadav</strong>
      </span>
      <ArrowUpRight size={12} aria-hidden="true" />
    </a>
  );
}
