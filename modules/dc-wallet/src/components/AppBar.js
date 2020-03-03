import { AppBar, Toolbar, IconButton, Typography, Grid, Button } from "@material-ui/core";
import { Settings as SettingIcon, ExitToApp as ExitToAppIcon } from "@material-ui/icons";
import blockies from "ethereum-blockies-png";
import React from "react";
import { Link } from "react-router-dom";

const noAddrBlocky = require("../assets/noAddress.png");

export const AppBarComponent = props => (
  <Grid container spacing={2}>
    <AppBar
      position="sticky"
      elevation={0}
      style={
        {
          paddingTop: "2%",
          zIndex: "auto",
          backgroundColor: '#000000'
        }
      }
    >
      <Toolbar
        style={
          {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
          }
        }
      >
        <IconButton
          disableTouchRipple
          color="inherit"
          variant="contained"
          component={Link}
          to="/deposit"
          style={{
            padding: "0",
            borderRadius: "0"
          }}
        >
          <img
            src={
              props.address ? blockies.createDataURL({ seed: props.address }) : noAddrBlocky
            }
            alt=""
          />
          <Typography
            variant="body2"
            noWrap
            style={{
              width: "10em",
              // color: "#c1c6ce",
              marginLeft: "1em",
            }}
          >
            <span>{props.address}</span>
          </Typography>
        </IconButton>

        <div>
          <Button
            size="small"
            variant="outlined"
            component="span"
            href="uniwebview://action?key=ReturnToUnity"
          >
            <ExitToAppIcon />
          </Button>
          <Button
            disableTouchRipple
            size="small"
            variant="outlined"
            style={{
              marginLeft: "0.5em"
            }}
            component={Link}
            to="/settings"
          >
            <SettingIcon />
          </Button>
        </div>
      </Toolbar>
    </AppBar>
  </Grid>
);
