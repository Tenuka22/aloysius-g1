import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { useAppForm } from "@/lib/app-form";
import { signInSchema } from "@/lib/validation";
import { FieldGroup } from "@/components/form-fields";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@aloysius-g1/ui/components/card";
import Loader from "./loader";

export default function SignInForm({
  onSwitchToSignUp,
}: {
  onSwitchToSignUp: () => void;
}) {
  const navigate = useNavigate({ from: "/" });
  const { isPending } = authClient.useSession();

  const form = useAppForm({
    defaultValues: { email: "", password: "" },
    validators: { onSubmit: signInSchema },
    onSubmit: async ({ value }) => {
      await authClient.signIn.email(
        { email: value.email, password: value.password },
        {
          onSuccess: () => {
            navigate({ to: "/dashboard" });
            toast.success("Sign in successful");
          },
          onError: (error) => {
            toast.error(error.error.message || error.error.statusText);
          },
        },
      );
    },
  });

  if (isPending) return <Loader />;

  return (
    <Card className="mx-auto mt-10 w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-center text-3xl font-bold">
          Welcome Back
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
        >
          <FieldGroup className="space-y-4">
            <form.AppField
              name="email"
              children={(field) => (
                <field.TextField label="Email" type="email" />
              )}
            />
            <form.AppField
              name="password"
              children={(field) => (
                <field.TextField label="Password" type="password" />
              )}
            />
          </FieldGroup>

          <div className="mt-4">
            <form.AppForm>
              <form.SubmitButton className="w-full">
                Sign In
              </form.SubmitButton>
            </form.AppForm>
          </div>
        </form>

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={onSwitchToSignUp}
            className="text-sm text-primary underline underline-offset-4 hover:text-primary/80"
          >
            Need an account? Sign Up
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
