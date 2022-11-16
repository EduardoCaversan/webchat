import styled from "styled-components";

export const Container = styled.div`
  display: flex;
  height: 100vh;
  align-items: center;
  justify-content: center;
  background: linear-gradient(0deg, #7DBA84, #8FD694);
  flex-direction: column;
`;

export const Button = styled.button`
  outline: none;
  font-size: 18px;
  padding: 14px 18px;
  cursor: pointer;
  background-color: rgba(205, 205, 205, 0.25);
  color: black;
  border-radius: 8px;
  border: none;
  box-shadow: 1.5px 2px 0 0 rgba(86, 86, 86, 1);
  margin-top: 25px;
`;

export const h2 = styled.h2`
  margin-top: 15px;
  color: black;
`;
