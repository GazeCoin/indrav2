import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Grid,
  InputAdornment,
  TextField,
  Typography,
  withStyles,
} from "@material-ui/core";
import { ArrowRight as SubmitIcon, Settings as SettingsIcon } from "@material-ui/icons";
import React, { useState } from "react";

import { Copyable } from "./copyable";

const style = withStyles(theme => ({
  card: {
    display: "flex",
    flexWrap: "wrap",
    flexDirection: "row",
    width: "100%",
    height: "70%",
    justifyContent: "center",
    padding: "4% 4% 4% 4%",
  },
  icon: {
    width: "40px",
    height: "40px",
  },
  input: {
    width: "100%",
  },
  button: {
    marginBottom: "0px",
  },
}));

export const SettingsCard = style(({ classes, setWalletConnext, getWalletConnext, store, history }) => {
  const [inputRecovery, setInputRecovery] = useState(false);
  const [isBurning, setIsBurning] = useState(false);
  const [mnemonic, setMnemonic] = useState("");
  const [showRecovery, setShowRecovery] = useState(false);
  const [showWarning, setShowWarning] = useState(false);

  const useWalletConnext = getWalletConnext();

  const generateNewAddress = async () => {
    setIsBurning(true);
    store && await store.reset(); // remove anything in the store related to the old channel
    localStorage.removeItem("mnemonic", mnemonic);
    window.open('uniwebview://action?mnemonic=' + mnemonic, "unitymsg");
    window.location.reload();
  };

  const recoverAddressFromMnemonic = async () => {
    store && await store.reset(); // remove anything in the store related to the old channel
    localStorage.setItem("mnemonic", mnemonic);
    window.open('uniwebview://action?mnemonic=' + mnemonic, "unitymsg");
    window.location.reload();
  };

  return (
    <Grid
      container
      spacing={2}
      direction="column"
      style={{
        paddingLeft: 12,
        paddingRight: 12,
        paddingTop: "10%",
        paddingBottom: "10%",
        textAlign: "center",
        justifyContent: "center",
      }}
    >
      <Grid item xs={12} style={{ justifyContent: "center" }}>
        <SettingsIcon className={classes.icon} />
      </Grid>

      {/*<Grid item xs={12} className={classes.button}>
        <Button
          disableTouchRipple
          fullWidth
          style={{
            background: "#FFF",
            border: "1px solid #7289da",
            color: "#7289da",
          }}
          onClick={() => {
            window.open("https://discord.gg/q2cakRc", "_blank");
            window.close();
            return false;
          }}
        >
          Support
        </Button>
      </Grid>*/}

      <Grid item xs={12} className={classes.button}>
        {!showRecovery ? (
          <Button
            disableTouchRipple
            fullWidth
            className={classes.button}
            color="primary"
            variant="outlined"
            onClick={() => setShowRecovery(true)}
          >
            Show Backup Phrase
          </Button>
        ) : (
          <Copyable color="primary" size="large" text={localStorage.getItem("mnemonic")} />
        )}
      </Grid>

      <Grid item xs={12} className={classes.button}>
        {!inputRecovery ? (
          <Button
            disableTouchRipple
            fullWidth
            className={classes.button}
            color="primary"
            variant="outlined"
            onClick={() => setInputRecovery(true)}
          >
            Import from Backup
          </Button>
        ) : (
          <TextField
            style={{ height: "40px", width: "80%" }}
            color="primary"
            variant="outlined"
            placeholder="Enter backup phrase and submit"
            value={mnemonic}
            onChange={event => setMnemonic(event.target.value)}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <Button
                    disableTouchRipple
                    fullWidth
                    variant="outlined"
                    color="primary"
                    style={{ marginRight: "-10%" }}
                    onClick={async () => await recoverAddressFromMnemonic()}
                  >
                    <SubmitIcon />
                  </Button>
                </InputAdornment>
              ),
            }}
          />
        )}
      </Grid>

      <Grid item xs={12} className={classes.button}>
        <Button
          disableTouchRipple
          fullWidth
          style={{
            color: '#A90004',
            textShadow: '0 0 4px #A90004',
            boxShadow: '0 0 4px #A90004',
          }}
          onClick={() => setShowWarning(true)}
        >
          Burn Card
        </Button>
        <Dialog
          open={showWarning}
          onBackdropClick={() => setShowWarning(false)}
          fullWidth
          style={{
            justifyContent: "center",
            alignItems: "center",
            textAlign: "center",
          }}
        >
          <Grid
            container
            style={{
              backgroundColor: "#FFF",
              padding: "3% 3% 3% 3%",
              flexDirection: "column",
            }}
          >
            <DialogTitle disableTypography>
              <Typography variant="h5" style={{ color: "#A90004" }}>
                Are you sure you want to burn your Card?
              </Typography>
            </DialogTitle>
            <DialogContent>
              {isBurning ? (
                <Grid item xs={12}>
                  <DialogContentText variant="body1">
                    Burning. Please do not refresh or navigate away. This page will refresh
                    automatically when it's done.
                  </DialogContentText>
                  <CircularProgress style={{ marginTop: "1em" }} />
                </Grid>
              ) : (
                <Grid container alignItems="center" justify="center" direction="column">
                  <Grid item xs={12}>
                    <DialogContentText variant="body1" style={{ color: "#A90004" }}>
                      You will lose access to your funds unless you save your backup phrase!
                    </DialogContentText>
                  </Grid>
                  <Grid item xs={12}>
                    <DialogActions>
                      <Button
                        disableTouchRipple
                        variant="outlined"
                        style={{
                          color: '#A90004',
                          textShadow: '0 0 4px #A90004',
                          boxShadow: '0 0 4px #A90004',
                        }}
                        onClick={async () => await generateNewAddress()}
                      >
                        Burn
                      </Button>
                      <Button
                        disableTouchRipple
                        style={{
                          marginLeft: "5%",
                        }}
                        variant="outlined"
                        style={{
                          color: '#A90004',
                          textShadow: '0 0 4px #A90004',
                          boxShadow: '0 0 4px #A90004',
                        }}
                        onClick={() => setShowWarning(false)}
                      >
                        Cancel
                      </Button>
                    </DialogActions>
                  </Grid>
                </Grid>
              )}
            </DialogContent>
          </Grid>
        </Dialog>
      </Grid>

      <Grid item xs={12}>
        <Button
          disableTouchRipple
          variant="outlined"
          onClick={() => history.push("/")}
        >
          Back
        </Button>
      </Grid>

      <Grid item xs={12}>
        <div>{navigator.userAgent + ' appName=' + navigator.appName}</div>
      </Grid>
    </Grid>
  );
});
