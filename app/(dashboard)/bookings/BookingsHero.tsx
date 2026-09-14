import Link from "next/link";
import { ArrowUpRight, Map } from "lucide-react";

export default function BookingsHero({ roomCount }: { roomCount?: number }) {
  return <div className="hub-page-heading">
    <div><p className="hub-eyebrow">Make room for good work</p><h1>Your next great meeting<span className="hub-red">.</span></h1><p>{roomCount ?? <span data-slot="skeleton" className="inline-block h-3 w-2 animate-pulse rounded align-middle" />} spaces to connect, collaborate and get things moving.</p></div>
    <Link href="/spaces" className="hub-button hub-button-outline"><Map size={16} /> Explore the floor <ArrowUpRight size={15} /></Link>
  </div>;
}
