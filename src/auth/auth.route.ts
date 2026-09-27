import { Router } from "express";
import { emailVerfication, loginUser, passwordReset, registerUser, updatePassword } from "./auth.controller";

export const authRouter = Router();

authRouter.post("/register", registerUser);
authRouter.post("/login", loginUser);
authRouter.post("/password-reset", passwordReset);
authRouter.put("/reset-password/:token", updatePassword);
authRouter.put("/verify-email", emailVerfication);