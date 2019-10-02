import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Grid,
  Typography,
  withStyles,
} from "@material-ui/core";
import {
  Done as DoneIcon,
  ErrorOutline as ErrorIcon,
  SaveAlt as ReceiveIcon,
} from "@material-ui/icons";
import { useMachine } from '@xstate/react';
import { AddressZero } from "ethers/constants";
import { formatEther } from "ethers/utils";
import React, { useCallback, useEffect, useState } from "react";
import queryString from "query-string";
import { Machine } from 'xstate';

import { Currency } from "../utils";

const style = withStyles(theme => ({
  icon: {
    width: "40px",
    height: "40px"
  },
  backButton: {
    background: "#FFF",
    border: "1px solid #F22424",
    color: "#F22424",
  },
  button: {
    backgroundColor: "#FCA311",
    color: "#FFF",
    marginBottom: "2em",
    marginTop: "2em",
  },
}));

const RedeemStateMachine = Machine({
  id: 'redeem',
  initial: 'idle',
  states: {
    'idle': { on: {
      'CHECK': 'checking',
    }},
    'checking': { on: {
      'ERROR': 'error',
      'INVALIDATE': 'invalid',
      'VALIDATE': 'ready',
    }},
    'invalid': { on: {
      'CLEAR': 'idle',
      'CHECK': 'checking',
    }},
    'ready': { on: {
      'CONFIRM': 'modal.confirm',
    }},
    'error': { on: {
      'CHECK': 'checking',
      'CLEAR': 'idle',
    }},
    modal: {
      id: 'modal',
      initial: 'confirm',
      on: {
        'GO_BACK': 'ready',
        'DISMISS': 'idle',
      },
      states: {
        'confirm': { on: {
          'COLLATERALIZE': 'collateralizing',
          'REDEEM': 'redeeming',
        }},
        'collateralizing': { on: {
          'ERROR': 'error',
          'REDEEM': 'redeeming',
        }},
        'redeeming': { on: {
          'ERROR': 'error',
          'SUCCESS': 'success',
        }},
        'error': {},
        'success': {},
      },
    },
  },
});

export const RedeemCard = style(({ channel, classes, history, location, tokenProfile }) => {
  const [paymentId, setPaymentId] = useState('')
  const [secret, setSecret] = useState('')
  const [link, setLink] = useState({
    amount: Currency.DAI('0'),
    assetId: AddressZero,
    status: 'UNKNOWN',
  });
  const [message, setMessage] = useState('');
  const [state, takeAction] = useMachine(RedeemStateMachine);

  const validateLink = useCallback(async () => {
    takeAction(`CHECK`)
    setMessage(`Verifying info...`)
    if (!channel || !tokenProfile) {
      setMessage(`Channel isn't ready yet..`)
      return;
    }
    if (!paymentId || typeof paymentId !== 'string') {
      takeAction(`INVALIDATE`)
      setMessage(`Missing a valid paymentId`)
      return;
    }
    const info = await channel.getLinkedTransfer(paymentId);
    console.log(`Got linked transfer ${paymentId}: ${JSON.stringify(info, null, 2)}`);
    if (!info) {
      takeAction(`INVALIDATE`)
      setMessage(`Unknown Payment Id`)
      return;
    }
    if (info.status !== 'PENDING') {
      takeAction('INVALIDATE')
      setMessage(`Payment has already been redeemed...`)
      return;
    }
    if (info.assetId !== tokenProfile.assetId) {
      takeAction(`INVALIDATE`)
      setMessage(`Only link payments for DAI are supported`)
      return;
    }
    if (!secret) {
      takeAction(`INVALIDATE`)
      setMessage(`No secret detected, cannot redeem payment.`);
      return;
    }
    takeAction(`VALIDATE`);
    setMessage(`Redeem whenever you're ready`);
    setLink({
      amount: Currency.DEI(info.amount).toDAI(),
      status: info.status,
      assetId: info.assetId,
    })
  }, [channel, paymentId, secret, takeAction, tokenProfile])

  useEffect(() => {
    (async () => {
      const query = queryString.parse(location.search);
      setPaymentId(query.paymentId)
      setSecret(query.secret)
      await validateLink();
    })()
  }, [location, validateLink]);

  const redeemPayment = async () => {
    if (!state.matches('modal.confirm')) { return; }
    console.log(`Attempting to redeem payment.`)
    let hubFreeBalanceAddress
    try {
      // if the token profile cannot handle the amount
      // update the profile, the hub will collateralize the
      // correct amount anyway from the listeners
      // Request token collateral if we don't have any yet
      let freeTokenBalance = await channel.getFreeBalance(tokenProfile.assetId);
      hubFreeBalanceAddress = Object.keys(freeTokenBalance).find(
        addr => addr.toLowerCase() !== channel.freeBalanceAddress.toLowerCase(),
      )
      // TODO: compare to default collateralization?
      if (freeTokenBalance[hubFreeBalanceAddress].lt(link.amount.wad)) {
        takeAction(`COLLATERALIZE`);
        setMessage(`Requesting ${link.amount.format()} of collateral`)
        const collateralNeeded = link.amount.wad.sub(freeTokenBalance[hubFreeBalanceAddress]);
        await channel.addPaymentProfile({
          amountToCollateralize: collateralNeeded.toString(),
          minimumMaintainedCollateral: link.amount.wad.toString(),
          assetId: tokenProfile.assetId,
        });
        await channel.requestCollateral(tokenProfile.assetId);
      }
    } catch (e) {
      takeAction('ERROR')
      setMessage(`Error collateralizing: ${e.message}`)
    }

    try {
      const freeTokenBalance = await channel.getFreeBalance(tokenProfile.assetId);
      console.log(`Hub has collateralized us with ${formatEther(freeTokenBalance[hubFreeBalanceAddress])} tokens`)
      takeAction(`REDEEM`);
      setMessage(`This should take just a few seconds`)
      const result = await channel.resolveCondition({
        conditionType: "LINKED_TRANSFER",
        paymentId,
        preImage: secret,
      });
      console.log(`Redeemed payment with result: ${JSON.stringify(result, null, 2)}`)
      // make sure hub isnt silently failing by returning null purchase id
      // as it processes collateral
      if (!result.paymentId) {
        // allows for retry logic
        takeAction(`ERROR`)
        setMessage(`Payment redemption failed, try again soon`)
        return;
      }
      takeAction('SUCCESS');
      setMessage(`Redeemed payment of ${link.amount.format()}`)
    } catch (e) {
      // known potential failure: already redeemed or channel not available
      if (e.message.indexOf("already been redeemed") !== -1) {
        takeAction('INVALIDATE');
        setMessage('Payment has already been redeemed');
        return;
      }
      takeAction('ERROR');
      setMessage(`Error redeeming`);
      console.error(e);
    }
  }

  let icon, title
  if (state.matches('idle')) {
    icon = (<ReceiveIcon className={classes.icon} />)
    title = "Input paymentId & secret to redeem"
  } else if (state.matches('checking')) {
    icon = (<CircularProgress className={classes.icon} />)
    title = "Verifying Payment"
  } else if (state.matches('invalid')) {
    icon = (<ErrorIcon className={classes.icon} />)
    title = "Invalid"
  } else if (state.matches('error')) {
    icon = (<ErrorIcon className={classes.icon} />)
    title = "Error"
  } else if (state.matches('ready')) {
    icon = (<DoneIcon className={classes.icon} />)
    title = "Ready"
  } else if (state.matches('collateralizing')) {
    icon = (<CircularProgress className={classes.icon} />)
    title = "Collateralizing"
  } else if (state.matches('redeeming')) {
    icon = (<CircularProgress className={classes.icon} />)
    title = "Redeeming link"
  } else if (state.matches('success')) {
    icon = (<DoneIcon className={classes.icon} />)
    title = "Success"
  }

  return (
    <Grid
      container
      spacing={1}
      direction="column"
      style={{
        paddingLeft: "10%",
        paddingRight: "10%",
        paddingTop: "10%",
        textAlign: "center",
        justifyContent: "center",
      }}
    >

      <Grid item xs={12}>
        {icon}
      </Grid>

      <Grid item xs={12}>
        <Typography noWrap variant="h5">
          <span>{title}</span>
        </Typography>
      </Grid>

      <Grid item xs={12}>
        <Typography variant="body1" style={{margin: "0.1em"}}>
          <span>{message}</span>
        </Typography>
      </Grid>

      <Grid container style={{marginBottom: "3%", marginTop: "3%"}}>
        <Grid item xs={5}>
          <Typography noWrap variant="body1">
             Amount: {link.amount.format() || "$0.00"}
          </Typography>
        </Grid>
        <Grid item xs={7}>
          <Typography variant="body1">
             Status: {link.status}
          </Typography>
        </Grid>
      </Grid>

      <Grid item xs={12}>
        <Typography noWrap variant="body1" style={{ width: "100%" }}>
          PaymentId: {paymentId}
        </Typography>
      </Grid>

      <Grid item xs={12}>
        <Typography noWrap variant="body1" style={{ width: "100%" }}>
          Secret: {secret}
        </Typography>
      </Grid>

      <Grid item xs={12}>
        <Button
          disableTouchRipple
          className={classes.button}
          disabled={!state.matches('ready')}
          fullWidth
          onClick={() => takeAction('CONFIRM')}
          size="large"
          variant="contained"
        >
          Redeem
        </Button>
      </Grid>

      <Grid item xs={12}>
        <Button
          disableTouchRipple
          variant="outlined"
          className={classes.backButton}
          size="medium"
          onClick={() => history.push("/")}
        >
          Back
        </Button>
      </Grid>

      <RedeemCardModal
        amount={link.amount}
        history={history}
        message={message}
        redeemPayment={redeemPayment}
        state={state}
        takeAction={takeAction}
      />
     </Grid>
  )
})

const RedeemCardModal = ({
  amount,
  history,
  message,
  redeemPayment,
  state,
  takeAction,
}) => (
  <Dialog
    open={state.matches('modal')}
    onBackdropClick={() => state.matches('confirm') ? takeAction('GO_BACK')
      : state.matches('collateralizing') || state.matches('redeeming') ? undefined
      : takeAction('DISMISS')
    }
    fullWidth
    style={{
      justifyContent: "center",
      alignItems: "center",
      textAlign: "center",
      margin: "0",
    }}
  >
    <Grid
      container
      spacing={1}
      direction="column"
      style={{
        textAlign: "center",
        justifyContent: "center",
        backgroundColor: "#FFF",
        margin: "0",
        width: "100%",
      }}
      justify="center"
    >

      {state.matches('modal.confirm') ? (
        <div>
          <DialogTitle disableTypography>
            <Typography variant="h5" style={{ color: "#F22424" }}>
              Are you sure you want to redeem?
            </Typography>
          </DialogTitle>
          <DialogContent>
            <DialogContentText variant="body1" style={{ color: "#0F1012", paddingTop: "5%" }}>
              The redeemed money will be saved to this browser's local storage.
            </DialogContentText>
            <DialogContentText variant="body1" style={{ color: "#0F1012", paddingTop: "5%" }}>
              WARNING: If you redeem this link in an incognito window or
              a temporary in-app browser then you will lose your money
              unless you back up your seed phrase (do so by visiting settings).
            </DialogContentText>
            <DialogActions style={{ textAlign: "center", justifyContent: "center" }} >
              <Button
                disableTouchRipple
                style={{ border: "1px solid #F22424", color: "#F22424", marginBottom: "1.5em" }}
                variant="outlined"
                size="medium"
                onClick={() => {
                  console.log(`Confirmed: redeeming payment`)
                  redeemPayment()
                }}
              >
                Confirm
              </Button>
              <Button
                disableTouchRipple
                style={{ border: "1px solid #F22424", color: "#F22424", marginBottom: "1.5em" }}
                variant="outlined"
                size="medium"
                onClick={() => takeAction('GO_BACK')}
              >
                Go Back
              </Button>
            </DialogActions>
          </DialogContent>
        </div>

      ) : state.matches('modal.collateralizing') ? (
        <Grid>
            <DialogTitle disableTypography>
              <Typography variant="h5" style={{ color: "#F22424" }}>
                Requesting Collateral...
              </Typography>
            </DialogTitle>
          <DialogContent>
            <DialogContentText variant="body1" style={{ color: "#0F1012" }}>
              {message}
            </DialogContentText>
          </DialogContent>
        </Grid>

      ) : state.matches('modal.redeeming') ? (
        <Grid>
            <DialogTitle disableTypography>
              <Typography variant="h5" style={{ color: "#F22424" }}>
                Redeeming Payment...
              </Typography>
            </DialogTitle>
          <DialogContent>
            <DialogContentText variant="body1" style={{ color: "#0F1012" }}>
              {message}
            </DialogContentText>
          </DialogContent>
        </Grid>

      ) : state.matches('modal.error') ? (
        <Grid>
            <DialogTitle disableTypography>
              <Typography variant="h5" style={{ color: "#F22424" }}>
                Failed to redeem payment
              </Typography>
            </DialogTitle>
          <DialogContent>
            <DialogContentText variant="body1" style={{ color: "#0F1012" }}>
              {message}
            </DialogContentText>
          </DialogContent>
        </Grid>

      ) : state.matches('modal.success') ? (
        <Grid>
          <DialogTitle disableTypography>
            <Typography variant="h5" style={{ color: "#009247" }}>
              Redeemed Successfully!
            </Typography>
          </DialogTitle>
          <DialogContent>
            <DialogContentText variant="body1" style={{ color: "#0F1012" }}>
              Amount: {amount.format()}
            </DialogContentText>
            <DialogActions style={{ textAlign: "center", justifyContent: "center" }} >
              <Button
                disableTouchRipple
                style={{ border: "1px solid #F22424", color: "#F22424", marginBottom: "1.5em" }}
                variant="outlined"
                size="medium"
                onClick={() => history.push("/")}
              >
                Home
              </Button>
            </DialogActions>
          </DialogContent>
        </Grid>
      ) : (<div/>)}

    </Grid>
  </Dialog>
);
