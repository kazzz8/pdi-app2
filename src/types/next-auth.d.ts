import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      employeeId: string;
      name: string;
      role: string;
      teamId: string | null;
      teamName: string | null;
    };
  }
}
