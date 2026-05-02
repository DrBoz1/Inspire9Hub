import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { createElement, type ReactElement } from "react";
import { BookingInvoice, type BookingInvoiceData } from "./booking-invoice";

export async function generateInvoicePDF(
  data: BookingInvoiceData,
): Promise<Buffer> {
  const element = createElement(
    BookingInvoice,
    data,
  ) as ReactElement<DocumentProps>;
  const buffer = await renderToBuffer(element);
  return Buffer.from(buffer);
}
