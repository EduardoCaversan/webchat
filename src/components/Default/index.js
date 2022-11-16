import React from "react";
import * as C from "./styles";

const Default = () => {
  return (
    <C.Container>
      <img src="https://cdn0.iconfinder.com/data/icons/squared-communication/64/messaging-app-512.png" alt="Icon" width="250px" height="250px"></img>
      <C.Title>Bro's Chat</C.Title>
      <C.Info>
        O Bro's Chat é um projeto simples de webchat desenvolvido por um iniciante com ReactJS. Sinta-se à vontade para testar o projeto e enviar seu feedback para o email: educaversan.dev@gmail.com
      </C.Info>
    </C.Container>
  );
};

export default Default;