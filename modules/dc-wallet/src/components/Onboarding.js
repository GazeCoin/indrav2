import { Button, Grid, withStyles } from "@material-ui/core";
import React from "react";
import { Link as RouterLink } from 'react-router-dom';

import "../App.css";

//import { store } from '../utils';

const styles = {};

const Link1 = React.forwardRef((props, ref) =>
    <RouterLink innerRef={ref} target="_blank" {...props} />);

class Onboarding extends React.Component {
  constructor(props) {
    super(props);
    //this.onrampRef = React.createRef();
    this.state = {
      onrampModal: false,
      channel: props.channel,
      store: props.channel ? props.channel.store : undefined,
    };
  }

  componentDidMount () {
/*    const script = document.createElement("script");
    script.src = "https://verify.sendwyre.com/js/widget-loader.js";
    script.async = true;
    script.innerHTML = 'var widget = new Wyre.Widget({ env: "test", auth: {"type": "secretKey", "secretKey": "aaaa"}, operation: {"type":"onramp", "destCurrency": "DAI"} });';
    this.onrampRef.current.appendChild(script);
*/
  }

  setPasscode = (passcode) => {
    console.log('new passcode: ' + passcode);
    localStorage.setItem("mnemonic", passcode);
  }

  handleSubmit = (e) => {
    e.preventDefault();
    const passcode = e.target.children[0].value;
    this.setPasscode(passcode);
  }

  render() {
    const { channel, associatedAddress } = this.props;
    const ethAddress = channel ? channel.freeBalanceAddress : null;
    return (
      <>
        <Button
          fullWidth
          variant="outlined"
          component={Link1}
          to={
            {
              pathname: "/requestcredit.html",
              search: "payAddress=" + ethAddress +
                    "&nftAddress=" + associatedAddress,
            }
          /* //Wyre transfer:
          { pathname: "https://pay.sendwyre.com/purchase",
                search: "?destCurrency=DAI" +
                  "&sourceAmount=10" +
                  "&dest=ethereum:" + ethAddress +
                  //"&accountId=AC_GQEAQV3A37U" +
                  //"&accountId=AC_J3QD6WH3B83" +
                  "&redirectUrl=https://card.gazecoin.xyz"
              }*/}
        >
          Top Up Credits
        </Button>

        <form id="passcodeForm" onSubmit={this.handleSubmit} hidden>
          <input id="setPasscode" type="hidden" onChange={this.setPasscode} />
          <input id="submitPasscode" type='submit' value='Submit' />
        </form>
      </>
    );
  }
}

export default withStyles(styles)(Onboarding);
