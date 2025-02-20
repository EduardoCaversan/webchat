import styled from "styled-components";

export const Container = styled.div`
  flex: 1;
  background: linear-gradient(0deg, gray, whitesmoke);
  overflow-y: auto;
  &::-webkit-scrollbar {
    width: 6px;
    border-radius: 10px;
  }
  &::-webkit-scrollbar-thumb {
    border-radius: 10px;
    background-color: rgba(0, 0, 0, 0.2);
  }
`;