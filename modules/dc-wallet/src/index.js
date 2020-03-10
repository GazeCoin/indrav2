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
      // main: "#3C0E5E",
      main: "#EF96FE",
    },
    secondary: {
      main: "#101010",
    },
    error: {
      main: '#A90004',
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
        color: '#06A500',
        textShadow: '0 0 4px #06A500',
        boxShadow: '0 0 4px #06A500',
      },
      outlinedPrimary: {
        color: '#EF96FE',
        textShadow: '0 0 4px #EF96FD',
        boxShadow: '0 0 4px #EF96FD',
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
