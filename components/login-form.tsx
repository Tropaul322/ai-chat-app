"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

type PendingAction = "login" | "anonymous"

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const isLoading = pendingAction !== null

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setPendingAction("login")

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    })

    const contentType = response.headers.get("content-type") ?? ""
    if (!contentType.includes("application/json")) {
      setError("Unexpected server response. Please try again.")
      setPendingAction(null)
      return
    }

    const data = (await response.json()) as { error?: string; ok?: boolean }

    if (!response.ok) {
      setError(data.error ?? "Login failed")
      setPendingAction(null)
      return
    }

    router.push("/")
    router.refresh()
  }

  async function handleAnonymousSignIn() {
    setError(null)
    setPendingAction("anonymous")

    const response = await fetch("/api/auth/anonymous", { method: "POST" })
    const contentType = response.headers.get("content-type") ?? ""

    if (!contentType.includes("application/json")) {
      setError("Unexpected server response. Please try again.")
      setPendingAction(null)
      return
    }

    const data = (await response.json()) as { error?: string; ok?: boolean }

    if (!response.ok) {
      setError(data.error ?? "Anonymous sign in failed")
      setPendingAction(null)
      return
    }

    router.push("/")
    router.refresh()
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle>Login to your account</CardTitle>
          <CardDescription>
            Enter your email below to login to your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <FieldGroup>
              <Field data-invalid={error ? true : undefined}>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  aria-invalid={error ? true : undefined}
                  required
                  disabled={isLoading}
                />
              </Field>
              <Field>
                <div className="flex items-center">
                  <FieldLabel htmlFor="password">Password</FieldLabel>
                  <a
                    href="#"
                    className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
                  >
                    Forgot your password?
                  </a>
                </div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  aria-invalid={error ? true : undefined}
                  required
                  disabled={isLoading}
                />
              </Field>
              {error ? <FieldError>{error}</FieldError> : null}
              <Field>
                <Button type="submit" disabled={isLoading}>
                  {pendingAction === "login" ? "Logging in..." : "Login"}
                </Button>
                <FieldSeparator>or</FieldSeparator>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isLoading}
                  onClick={handleAnonymousSignIn}
                >
                  {pendingAction === "anonymous"
                    ? "Starting guest session..."
                    : "Continue as guest"}
                </Button>
                <FieldDescription className="text-center">
                  Don&apos;t have an account?{" "}
                  <Link href="/signup">Sign up</Link>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
