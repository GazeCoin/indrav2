import {
  Button,
  CircularProgress,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Grid,
  TextField,
  Typography,
  withStyles,
  IconButton,
} from "@material-ui/core";
import { SwapHorizontalCircle as SwapIcon } from "@material-ui/icons";
import { Zero } from "ethers/constants";
import React, { Component } from "react";
import queryString from "query-string";

import { Currency } from "../utils";

const SWAP_LIMIT = Currency.DAI("10"); // $10 capped swap amount

const styles = theme => ({
  icon: {
    width: "40px",
    height: "40px",
  },
  input: {
    width: "100%",
  },
});

const PaymentStates = {
  None: 0,
  Collateralizing: 1,
  CollateralTimeout: 2,
  OtherError: 3,
  Success: 4,
};

class BuyTipsCard extends Component {
  constructor(props) {
    super(props);
    this.state = {
      amount: { display: "", error: null, value: null },
      tips: { display: "", error: null, value: null },
      recipient: { display: "", error: null, value: null },
      sendError: null,
      scan: false,
      showReceipt: false,
      paymentState: PaymentStates.None,
      isBuy: true,
    };
  }

  async componentDidMount() {
    const query = queryString.parse(this.props.location.search);
    if (query.amountToken) {
      this.updateAmountHandler(query.amountToken);
    }
    if (query.tipsToken) {
      this.updateTipsHandler(query.tipsToken);
    }
  }

  async updateAmountHandler(rawValue) {
    const { balance } = this.props;
    const { isBuy } = this.state;
    let value = null,
      error = null;
    try {
      value = Currency.DAI(rawValue);
    } catch (e) {
      error = e.message;
    }
    if (isBuy && value && value.wad.gt(balance.channel.token.wad)) {
      error = `Invalid amount: must be less than your balance`;
    }
    if (value && value.wad.lte(Zero)) {
      error = "Invalid amount: must be greater than 0";
    }
    this.setState({
      amount: {
        display: rawValue,
        error,
        value: error ? null : value,
      },
    });
  }

  async updateTipsHandler(rawValue) {
    const { balance } = this.props;
    const { isBuy } = this.state;
    let value = null,
      error = null;
    try {
      value = Currency.TIP(rawValue);
    } catch (e) {
      error = e.message;
    }
    if (!isBuy && value && value.wad.gt(balance.channel.tipToken.wad)) {
      error = `Invalid amount: must be less than your balance`;
    }
    if (value && value.wad.lte(Zero)) {
      error = "Invalid amount: must be greater than 0";
    }
    this.setState({
      tips: {
        display: rawValue,
        error,
        value: error ? null : value,
      },
    });
  }

  async buyTipsHandler() {
    const { channel, token, tipToken } = this.props;
    const { amount, tips, address, isBuy } = this.state;
    if (amount.error || tips.error) return;

    console.log(`Swapping 1 for 1000 rewards`);
    this.setState({ paymentState: PaymentStates.Collateralizing });

    // there is a chance the payment will fail when it is first sent
    // due to lack of collateral. collateral will be auto-triggered on the
    // hub side. retry for 1min, then fail
    const endingTs = Date.now() + 60 * 1000;
    let transferRes = undefined;
    while (Date.now() < endingTs) {
      try {
        var swapParams = {};
        if (isBuy) {
          await channel.requestCollateral(tipToken.address);
          swapParams.amount= "1000000000000000000";
          swapParams.fromAssetId = token.address;
          swapParams.toAssetId = tipToken.address;
          swapParams.swapRate = "1000";
        } else {
          swapParams.amount = "1000000000000000000000";
          swapParams.fromAssetId = tipToken.address;
          swapParams.toAssetId = token.address;
          swapParams.swapRate = "0.001";
        }

        console.log('Trying transfer' );
        transferRes = await channel.swap(swapParams);
        console.log('transferRes', transferRes );

        //await this.refreshBalances();
        break;
      } catch (e) {
        console.log('error' + e.message);
        await new Promise(res => setTimeout(res, 5000));
      }
    }
    if (!transferRes) {
      console.log('Swap failed');
      this.setState({ paymentState: PaymentStates.OtherError, showReceipt: true });
      return;
    }
    console.log('Swap succeeded');
    this.setState({ showReceipt: true, paymentState: PaymentStates.Success });
  }

  async swapDirectionHandler() {
    const { isBuy } = this.state;
    this.setState({ isBuy: !isBuy });
  }

  closeModal = () => {
    this.setState({ showReceipt: false, paymentState: PaymentStates.None });
  };

  render() {
    const { classes } = this.props;
    const { amount, tips, recipient, paymentState, showReceipt, sendError, isBuy } = this.state;
    const buyOrSell = isBuy ? "Buy" : "Sell";
    return (
      <Grid
        container
        spacing={2}
        direction="column"
        style={{
          display: "flex",
          paddingLeft: 12,
          paddingRight: 12,
          paddingTop: "10%",
          paddingBottom: "10%",
          textAlign: "center",
          justify: "center",
        }}
      >
        <Grid container wrap="nowrap" direction="row" justify="center" alignItems="center">
          <Grid item xs={12}>
            <SwapIcon className={classes.icon} />
          </Grid>
        </Grid>
        <Grid item xs={12}>
          <Grid container direction="row" justify="center" alignItems="center">
            <Typography variant="h4">
              <span>{this.props.balance.channel.token.toDAI().format()}</span>
            </Typography>
          </Grid>
          <Grid container direction="row" justify="center" alignItems="center">
            <Typography variant="h5">
              <span>{this.props.balance.channel.tipToken.toTIP().format()}</span>
            </Typography>
            <Typography variant="body2">
              TIPS
            </Typography>
          </Grid>
        </Grid>
        <Grid container direction="row" alignItems="center" justify="center" spacing={8}>
          <Grid item xs={5}>
            <TextField
              fullWidth
              id="outlined-number"
              label="Credits"
              value={1}
              disabled={true}
              type="number"
              margin="normal"
              variant="outlined"
              helperText={amount.error}
            />
          </Grid>
          <Grid item xs={2}>
            <IconButton
              aria-label="swap"
              className={classes.margin}
              size="medium"
              onClick={() => {
                this.swapDirectionHandler();
              }}
            >
              <SwapIcon fontSize="inherit" />
            </IconButton>
          </Grid>
          <Grid item xs={5}>
            <TextField
              fullWidth
              id="outlined-number"
              label="Tip Tokens"
              value={1000}
              disabled={true}
              type="number"
              margin="normal"
              variant="outlined"
              helperText={tips.error}
            />
          </Grid>
        </Grid>
        <Grid item xs={12}>
          <Button
            className={classes.button}
            disabled={!!amount.error || !!tips.error}
            fullWidth
            onClick={() => {
              this.buyTipsHandler();
            }}
            color="primary"
            variant="outlined"
          >
            {buyOrSell + ' TIP TOKENS'}
          </Button>
        </Grid>
        <Grid item xs={12}>
          <Button
            variant="outlined"
            onClick={() => this.props.history.push("/")}
          >
            Back
          </Button>
        </Grid>
      </Grid>
    );
  }
}

function ConfirmationDialogText(paymentState, amountToken, recipient) {
  switch (paymentState) {
    case PaymentStates.Collateralizing:
      return (
        <Grid>
          <DialogTitle disableTypography>
            <Typography variant="h5" color="primary">
              Payment In Progress
            </Typography>
          </DialogTitle>
          <DialogContent>
            <DialogContentText variant="body1" style={{ color: "#0F1012", margin: "1em" }}>
              Recipient's Card is being set up. This should take 20-30 seconds.
            </DialogContentText>
            <DialogContentText variant="body1" style={{ color: "#0F1012" }}>
              If you stay on this page, your payment will be retried automatically. If you navigate
              away or refresh the page, you will have to attempt the payment again yourself.
            </DialogContentText>
            <CircularProgress style={{ marginTop: "1em" }} />
          </DialogContent>
        </Grid>
      );
    case PaymentStates.CollateralTimeout:
      return (
        <Grid>
          <DialogTitle disableTypography>
            <Typography variant="h5" style={{ color: "#F22424" }}>
              Payment Failed
            </Typography>
          </DialogTitle>
          <DialogContent>
            <DialogContentText variant="body1" style={{ color: "#0F1012", margin: "1em" }}>
              After some time, recipient channel could not be initialized.
            </DialogContentText>
            <DialogContentText variant="body1" style={{ color: "#0F1012" }}>
              Is the receiver online to set up their Card? Please try your payment again later. If
              you have any questions, please contact support. (Settings --> Support)
            </DialogContentText>
          </DialogContent>
        </Grid>
      );
    case PaymentStates.OtherError:
      return (
        <Grid>
          <DialogTitle disableTypography>
            <Typography variant="h5" style={{ color: "#F22424" }}>
              Payment Failed
            </Typography>
          </DialogTitle>
          <DialogContent>
            <DialogContentText variant="body1" style={{ color: "#0F1012", margin: "1em" }}>
              An unknown error occured when making your payment.
            </DialogContentText>
            <DialogContentText variant="body1" style={{ color: "#0F1012" }}>
              Please try again in 30s and contact support if you continue to experience issues.
              (Settings --> Support)
            </DialogContentText>
          </DialogContent>
        </Grid>
      );
    case PaymentStates.Success:
      return (
        <Grid>
          <DialogTitle disableTypography>
            <Typography variant="h5" style={{ color: "#009247" }}>
              Payment Success!
            </Typography>
          </DialogTitle>
          <DialogContent>
            <DialogContentText variant="body1" style={{ color: "#0F1012", margin: "1em" }}>
              Amount: ${amountToken}
            </DialogContentText>
            <DialogContentText variant="body1" style={{ color: "#0F1012" }}>
              To: {recipient.substr(0, 5)}...
            </DialogContentText>
          </DialogContent>
        </Grid>
      );
    case PaymentStates.None:
    default:
      return <div />;
  }
}

export default withStyles(styles)(BuyTipsCard);
