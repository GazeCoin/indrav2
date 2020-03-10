import { MuiThemeProvider, createMuiTheme } from "@material-ui/core/styles";
import React from "react";
import ReactDOM from "react-dom";

import App from "./App";
import "./index.css";
import * as serviceWorker from "./serviceWorker";

const theme = createMuiTheme({
  palette: {
    type: "dark",
    primary: {
      main: "#E900FF",
    },
    secondary: {
      main: "#101010",
    },
    error: {
      main: '#FF000C',
    },
    background: {
      default: '#000000',
      paper: '#101010',
    },
  },
  typography: {
    useNextVariants: true,
    button: {
      fontFamily: 'dreamchannelfontregular',
      fontWeight: 'bold',
      fontSize: '1.35rem',
    }
  },
  overrides: {
    MuiButton: {
      outlined: {
        color: '#10FF00',
        textShadow: '0 0 4px #10FF00',
        boxShadow: '0 0 4px #10FF00',
      },
      outlinedPrimary: {
        color: '#E900FF',
        textShadow: '0 0 4px #E900FF',
        boxShadow: '0 0 4px #E900FF',
      },
    },
  }
});

ReactDOM.render(
  <MuiThemeProvider theme={theme}>
    <App />
  </MuiThemeProvider>,
  document.getElementById("root"),
);

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: http://bit.ly/CRA-PWA
serviceWorker.unregister();
