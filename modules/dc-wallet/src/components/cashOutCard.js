import { Button, CircularProgress, Grid, Typography, withStyles } from "@material-ui/core";
import { Unarchive as UnarchiveIcon } from "@material-ui/icons";
import { AddressZero, Zero } from "ethers/constants";
import React, { useState } from "react";

import EthIcon from "../assets/Eth.svg";
import DaiIcon from "../assets/dai.svg";
import { inverse } from "../utils";

import { useAddress, AddressInput } from "./input";

const style = withStyles(theme => ({
  icon: {
    width: "40px",
    height: "40px",
  },
  modal: {
    position: "absolute",
    top: "-400px",
    left: "150px",
    width: theme.spacing(50),
    backgroundColor: theme.palette.background.paper,
    boxShadow: theme.shadows[5],
    padding: theme.spacing(4),
    outline: "none",
  },
}));

export const CashoutCard = style(({
  balance,
  channel,
  classes,
  ethProvider,
  history,
  machine,
  refreshBalances,
  swapRate,
  token,
  associatedAddress,
}) => {
  const [withdrawing, setWithdrawing] = useState(false);
  const [recipient, setRecipient] = useAddress(associatedAddress, ethProvider);

  const cashoutTokens = async () => {
    const value = recipient.value;
    if (!channel || !value) return;
    const total = balance.channel.total;
    if (total.wad.lte(Zero)) return;
    // Put lock on actions, no more autoswaps until we're done withdrawing
    machine.send("START_WITHDRAW");
    setWithdrawing(true);
    console.log(`Withdrawing ${total.toETH().format()} to: ${value}`);
    const result = await channel.withdraw({
      amount: balance.channel.token.wad.toString(),
      assetId: token.address,
      recipient: value,
    });
    console.log(`Cashout result: ${JSON.stringify(result)}`);
    const txHash = result.transaction.hash;
    setWithdrawing(false);
    machine.send("SUCCESS_WITHDRAW", { txHash });
  };

  const cashoutEther = async () => {
    const value = recipient.value;
    if (!channel || !value) return;
    const total = balance.channel.total;
    if (total.wad.lte(Zero)) return;
    // Put lock on actions, no more autoswaps until we're done withdrawing
    machine.send("START_WITHDRAW");
    setWithdrawing(true);
    console.log(`Withdrawing ${total.toETH().format()} to: ${value}`);
    // swap all in-channel tokens for eth
    if (balance.channel.token.wad.gt(Zero)) {
      await channel.requestCollateral(AddressZero);
      await channel.swap({
        amount: balance.channel.token.wad.toString(),
        fromAssetId: token.address,
        swapRate: inverse(swapRate),
        toAssetId: AddressZero,
      });
      await refreshBalances();
    }
    const result = await channel.withdraw({
      amount: balance.channel.ether.wad.toString(),
      assetId: AddressZero,
      recipient: value,
    });
    console.log(`Cashout result: ${JSON.stringify(result)}`);
    const txHash = result.transaction.hash;
    setWithdrawing(false);
    machine.send("SUCCESS_WITHDRAW", { txHash });
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
      <Grid container wrap="nowrap" direction="row" justify="center" alignItems="center">
        <Grid item xs={12}>
          <UnarchiveIcon className={classes.icon} />
        </Grid>
      </Grid>
      <Grid item xs={12}>
        <Grid container direction="row" justify="center" alignItems="center">
          <Typography variant="h2">
            <span>
              {balance.channel.token
                .toDAI(swapRate)
                .format({ decimals: 2, symbol: false, round: false })}
            </span>
          </Typography>
        </Grid>
      </Grid>
      <Grid item xs={12}>
        <Typography variant="caption">
          <span>{"ETH price: $" + swapRate}</span>
        </Typography>
      </Grid>
      <Grid item xs={12}>
        <AddressInput address={recipient} setAddress={setRecipient} />
      </Grid>
      <Grid item xs={12}>
        <Grid container spacing={8} direction="row" alignItems="center" justify="center">
          <Grid item xs={6}>
            <Button
              disableTouchRipple
              color="primary"
              variant="outlined"
              className={classes.button}
              fullWidth
              onClick={cashoutEther}
              disabled={!recipient.value}
              style={{
                fontSize: '0.9rem'
              }}
              endIcon={<img
                src={EthIcon}
                style={{ width: "15px", height: "15px" }}
                alt=""
              />}
            >
              Cash Out Eth
            </Button>
          </Grid>
          <Grid item xs={6}>
            <Button
              disableTouchRipple
              className={classes.button}
              color="primary"
              variant="outlined"
              fullWidth
              onClick={cashoutTokens}
              disabled={ !recipient.value }
              style={{
                fontSize: '0.9rem'
              }}
              endIcon={<img
                src={DaiIcon}
                style={{ width: "15px", height: "15px" }}
                alt=""
              />}
            >
              Cash Out Dai
            </Button>
          </Grid>
        </Grid>
      </Grid>
      <Grid item xs={12}>
        <Button
          disableTouchRipple
          variant="outlined"
          onClick={() => history.push("/")}
        >
          Back
        </Button>
        <Grid item xs={12} style={{ paddingTop: "10%" }}>
          {withdrawing && <CircularProgress color="primary" />}
        </Grid>
      </Grid>
    </Grid>
  );
});
