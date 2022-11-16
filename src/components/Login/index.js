import React from "react";
import { auth, provider } from "../../services/firebase";
import * as C from "./styles";

const Login = () => {
  const handleSignin = () => {
    auth.signInWithPopup(provider).catch(alert);
  };
  return (
    <C.Container>      
      <img src="https://cdn0.iconfinder.com/data/icons/squared-communication/64/messaging-app-512.png" alt="Icon" width="150px" height="150px"></img>
      <C.h2>Bem vindo(a) ao Bro's Chat!</C.h2>
      <C.Button onClick={handleSignin}>Login com Google</C.Button>
    </C.Container>
  );
};

export default Login;