import type { Metadata } from "next";
import { EnquiryForm } from "./EnquiryForm";

export const metadata: Metadata = {
  title: "Enquire about space | Inspire9",
  description: "Desks, private offices and meeting rooms at Inspire9 in Richmond. Tell us what you need and we’ll show you around.",
};

export default function EnquirePage() {
  return <EnquiryForm />;
}
