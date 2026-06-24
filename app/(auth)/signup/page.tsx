import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signUp } from "../actions";

type SearchParams = Promise<{ error?: string; message?: string }>;

export default async function SignupPage(props: {
  searchParams: SearchParams;
}) {
  const searchParams = (await props.searchParams) || {};
  const error = searchParams.error;
  const message = searchParams.message;
  return (
    <div className="flex min-h-screen w-full">
      <div className="flex w-full flex-col justify-center bg-[#F3F3F3] px-8 md:w-1/2 lg:px-24">
        <div className="mx-auto w-full max-w-sm">
          {/*placeholder for logo (later fr) */}
          <div className="mb-8 flex justify-center">
            <Image
              src="/images/inspire9Logo.png"
              alt="Inspire9 Logo"
              width={180}
              height={60}
              className="w-45 h-15 object-contain"
            />
          </div>
          <form action={signUp} className="space-y-4">
            {error && (
              <div className="text-red-500 text-sm text-center">{error}</div>
            )}
            {message && (
              <div className="text-green-600 text-sm text-center">
                {message}
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="name" className="text-gray-400">
                Name
              </Label>
              <Input
                name="name"
                id="name"
                type="name"
                placeholder="Enter your name"
                className="bg-white"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email" className="text-gray-400">
                Email
              </Label>
              <Input
                name="email"
                id="email"
                type="email"
                placeholder="Enter your email"
                className="bg-white"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password" className="text-gray-400">
                Password
              </Label>
              <Input
                name="password"
                id="password"
                type="password"
                placeholder="Enter your password"
                className="bg-white"
              />
            </div>
            <div className="flex justify-center">
              <Button className="w-fit bg-[#E31E24] hover:bg-[#c1191f] text-white rounded-md text-md transition-all">
                Create Account
              </Button>
            </div>
          </form>
          <div className="mt-6 text-center text-sm text-gray-500">
            Already have an account?{" "}
          </div>
          <div className="mt-2 text-center text-sm">
            <Link href="/login" className="text-gray-400 hover:text-gray-600">
              Login Here
            </Link>
          </div>
        </div>
      </div>
      <div className="hidden w-1/2 bg-gray-200 lg:block relative">
        <Image
          src="/images/login-side.jpg"
          alt="coworking space image"
          fill
          sizes="(min-width: 1024px) 50vw, 0vw"
          className="object-cover"
        />
      </div>
    </div>
  );
}
