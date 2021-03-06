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
  Modal,
  TextField,
  Tooltip,
  Typography,
  withStyles,
} from "@material-ui/core";
import { Send as SendIcon, Link as LinkIcon } from "@material-ui/icons";
import { Zero } from "ethers/constants";
import QRIcon from "mdi-material-ui/QrcodeScan";
import React, { Component } from "react";
import queryString from "query-string";

import { utils } from "@connext/client"

import { Currency, toBN, delay } from "../utils";

import { QRScan } from "./qrCode";

const LINK_LIMIT = Currency.DAI("10"); // $10 capped linked payments

const { createPaymentId, createPreImage } = utils;

const styles = theme => ({
  icon: {
    width: "40px",
    height: "40px",
  },
  input: {
    width: "100%",
  },
  button: {
    backgroundColor: "#FCA311",
    color: "#FFF",
  },
});

const PaymentStates = {
  None: 0,
  Collateralizing: 1,
  CollateralTimeout: 2,
  OtherError: 3,
  Success: 4,
};

class SendCard extends Component {
  constructor(props) {
    super(props);
    this.state = {
      amount: { display: "", error: null, value: null },
      recipient: { display: "", error: null, value: null },
      sendError: null,
      scan: false,
      showReceipt: false,
      paymentState: PaymentStates.None,
    };
  }

  async componentDidMount() {
    const query = queryString.parse(this.props.location.search);
    if (query.amountToken) {
      this.updateAmountHandler(query.amountToken);
    }
    if (query.recipient) {
      this.updateRecipientHandler(query.recipient);
    }
  }

  handleQRData = async scanResult => {
    let data = scanResult.split("/send?");
    if (data[0] === window.location.origin) {
      const query = queryString.parse(data[1]);
      if (query.amountToken) {
        this.updateAmountHandler(query.amountToken);
      }
      if (query.recipient) {
        this.updateRecipientHandler(query.recipient);
      }
    } else {
      console.warn(`QR Code was generated by incorrect site: ${data[0]}`);
    }
    this.setState({ scan: false });
  };

  async updateAmountHandler(rawValue) {
    const { balance } = this.props;
    let value = null,
      error = null;
    try {
      value = Currency.DAI(rawValue);
    } catch (e) {
      error = e.message;
    }
    if (value && value.wad.gt(balance.channel.token.wad)) {
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

  async updateRecipientHandler(rawValue) {
    const xpubLen = 111;
    let value = null,
      error = null;
    value = rawValue;
    if (!value.startsWith("xpub")) {
      error = "Invalid recipient: should start with xpub";
    }
    if (!error && value.length !== xpubLen) {
      error = `Invalid recipient: expected ${xpubLen} characters, got ${value.length}`;
    }
    this.setState({
      recipient: {
        display: rawValue,
        error,
        value: error ? null : value,
      },
    });
  }

  async paymentHandler() {
    const { channel, token } = this.props;
    const { amount, recipient } = this.state;
    if (amount.error || recipient.error) return;

    console.log(`Sending ${amount.value} to ${recipient.value}`);
    this.setState({ paymentState: PaymentStates.Collateralizing });

    // there is a chance the payment will fail when it is first sent
    // due to lack of collateral. collateral will be auto-triggered on the
    // hub side. retry for 1min, then fail
    const endingTs = Date.now() + 60 * 1000;
    let transferRes = undefined;
    while (Date.now() < endingTs) {
      try {
        transferRes = await channel.transfer({
          assetId: token.address,
          amount: amount.value.wad.toString(),
          recipient: recipient.value,
        });
        break;
      } catch (e) {
        await delay(5000);
      }
    }
    if (!transferRes) {
      this.setState({ paymentState: PaymentStates.OtherError, showReceipt: true });
      return;
    }
    this.setState({ showReceipt: true, paymentState: PaymentStates.Success });
  }

  async linkHandler() {
    const { channel, token } = this.props;
    const { amount, recipient } = this.state;
    if (amount.error || recipient.error) return;
    if (toBN(amount.value.toDEI()).gt(LINK_LIMIT.wad)) {
      this.setState(oldState => {
        oldState.amount.error = `Linked payments are capped at ${LINK_LIMIT.format()}.`;
        return oldState;
      });
      return;
    }
    try {
      console.log(`Creating ${amount.value.format()} link payment`);
      const link = await channel.conditionalTransfer({
        assetId: token.address,
        amount: amount.value.wad.toString(),
        conditionType: "LINKED_TRANSFER",
        paymentId: createPaymentId(),
        preImage: createPreImage(),
      });
      console.log(`Created link payment: ${JSON.stringify(link, null, 2)}`);
      console.log(
        `link params: secret=${link.preImage}&paymentId=${link.paymentId}&` +
          `assetId=${token.address}&amount=${amount.value.amount}`,
      );
      this.props.history.push({
        pathname: "/redeem",
        search:
          `?secret=${link.preImage}&paymentId=${link.paymentId}&` +
          `assetId=${token.address}&amount=${amount.value.amount}`,
        state: { isConfirm: true, secret: link.preImage, amountToken: amount.value.amount },
      });
    } catch (e) {
      console.log("Unexpected error sending payment:", e);
      this.setState({ paymentState: PaymentStates.OtherError, showReceipt: true });
    }
  }

  closeModal = () => {
    this.setState({ showReceipt: false, paymentState: PaymentStates.None });
  };

  render() {
    const { classes } = this.props;
    const { amount, recipient, paymentState, scan, showReceipt, sendError } = this.state;
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
            <SendIcon className={classes.icon} />
          </Grid>
        </Grid>
        <Grid item xs={12}>
          <Grid container direction="row" justify="center" alignItems="center">
            <Typography variant="h2">
              <span>{this.props.balance.channel.token.toDAI().format()}</span>
            </Typography>
          </Grid>
        </Grid>
        <Grid item xs={12}>
          <Typography variant="body2">
            <span>{`Linked payments are capped at ${LINK_LIMIT.format()}.`}</span>
          </Typography>
        </Grid>
        <Grid item xs={12}>
          <TextField
            fullWidth
            id="outlined-number"
            label="Amount"
            value={amount.display}
            type="number"
            margin="normal"
            variant="outlined"
            onChange={evt => this.updateAmountHandler(evt.target.value)}
            error={amount.error !== null}
            helperText={amount.error}
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            style={{ width: "100%" }}
            id="outlined"
            label="Recipient Address"
            type="string"
            value={recipient.display}
            onChange={evt => this.updateRecipientHandler(evt.target.value)}
            margin="normal"
            variant="outlined"
            helperText={recipient.error ? recipient.error : "Optional for linked payments"}
            error={recipient.error !== null}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <Tooltip disableFocusListener disableTouchListener title="Scan with QR code">
                    <Button
                      variant="contained"
                      color="primary"
                      style={{ color: "#FFF" }}
                      onClick={() => this.setState({ scan: true })}
                    >
                      <QRIcon />
                    </Button>
                  </Tooltip>
                </InputAdornment>
              ),
            }}
          />
        </Grid>
        <Modal
          id="qrscan"
          open={scan}
          onClose={() => this.setState({ scan: false })}
          style={{
            justifyContent: "center",
            alignItems: "center",
            textAlign: "center",
            position: "absolute",
            top: "10%",
            width: "375px",
            marginLeft: "auto",
            marginRight: "auto",
            left: "0",
            right: "0",
          }}
        >
          <QRScan handleResult={this.handleQRData} history={this.props.history} />
        </Modal>
        <Grid item xs={12}>
          <Grid container direction="row" alignItems="center" justify="center" spacing={8}>
            <Grid item xs={6}>
              <Button
                className={classes.button}
                disabled={!!amount.error || !!recipient.error}
                fullWidth
                onClick={() => {
                  this.linkHandler();
                }}
                size="large"
                variant="contained"
              >
                Link
                <LinkIcon style={{ marginLeft: "5px" }} />
              </Button>
            </Grid>
            <Grid item xs={6}>
              <Button
                className={classes.button}
                disabled={
                  !!amount.error ||
                  !!recipient.error ||
                  paymentState === PaymentStates.Collateralizing
                }
                fullWidth
                onClick={() => {
                  this.paymentHandler();
                }}
                size="large"
                variant="contained"
              >
                Send
                <SendIcon style={{ marginLeft: "5px" }} />
              </Button>
            </Grid>
          </Grid>
        </Grid>
        <Grid item xs={12}>
          <Button
            variant="outlined"
            style={{
              background: "#FFF",
              border: "1px solid #F22424",
              color: "#F22424",
              width: "15%",
            }}
            size="medium"
            onClick={() => this.props.history.push("/")}
          >
            Back
          </Button>
        </Grid>
        <PaymentConfirmationDialog
          showReceipt={showReceipt}
          sendError={sendError}
          amountToken={amount.display ? amount.display : "0"}
          recipient={recipient.value}
          history={this.props.history}
          closeModal={this.closeModal}
          paymentState={paymentState}
        />
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
function PaymentConfirmationDialog(props) {
  return (
    <Dialog
      open={props.showReceipt}
      onBackdropClick={
        props.paymentState === PaymentStates.Collateralizing ? null : () => props.closeModal()
      }
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
          paddingTop: "10%",
          paddingBottom: "10%",
        }}
        justify="center"
      >
        {ConfirmationDialogText(props.paymentState, props.amountToken, props.recipient)}
        {props.paymentState === PaymentStates.Collateralizing ? (
          <></>
        ) : (
          <DialogActions>
            <Button
              color="primary"
              variant="outlined"
              size="medium"
              onClick={() => props.closeModal()}
            >
              Pay Again
            </Button>
            <Button
              style={{
                background: "#FFF",
                border: "1px solid #F22424",
                color: "#F22424",
                marginLeft: "5%",
              }}
              variant="outlined"
              size="medium"
              onClick={() => props.history.push("/")}
            >
              Home
            </Button>
          </DialogActions>
        )}
      </Grid>
    </Dialog>
  );
}
export default withStyles(styles)(SendCard);
