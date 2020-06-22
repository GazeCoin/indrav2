import { Button, Grid, withStyles } from "@material-ui/core";
import React from "react";
import { Link as RouterLink } from 'react-router-dom';

import "../App.css";

//import { store } from '../utils';

const styles = {};

function setAddressScript() {
  return {__html: '<script>function setAddr(addr) {assert(addr);}</script>'}
}

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


  handleSubmit = (e) => {
    e.preventDefault();
    const address = e.target.children[0].value;
    console.log('submit' + address);
    var store = this.state.store;
    if (store) {
      store.set([ {path: 'ethAddress', value: address }]);
    }
  }

  setAddress = (addr) => {
    console.log('new address: ' + addr);
    var store = this.state.store;
    if (store) {
      store.set([ {path: 'ethAddress', value: addr }]);
    }
  }

  render() {
    //const { address } = this.props;
    const { store, channel } = this.state;
    const ethAddress = store ? store.get('ethAddress') :
      channel ? channel.freeBalanceAddress : 'ETH address not available!';
    return (
      <>
        <Grid
          container
          spacing={1}
          direction="column"
          style={{ paddingLeft: "2%", paddingRight: "2%", textAlign: "center" }}
        >
          <Grid item xs={12}>
            <Button
              style={{ marginBottom: "5%" }}
              fullWidth
              color="primary"
              variant="outlined"
              size="large"
              component={Link1}
              to={'/requestgrant'/*{ pathname: "https://pay.sendwyre.com/purchase",
                    search: "?destCurrency=DAI" +
                      "&sourceAmount=10" +
                      "&dest=ethereum:" + ethAddress +
                      //"&accountId=AC_GQEAQV3A37U" +
                      //"&accountId=AC_J3QD6WH3B83" +
                      "&redirectUrl=https://card.gazecoin.xyz"
                  }*/}
            >
              Buy Credits
            </Button>
          </Grid>
          <Grid item xs={12}>
            <form id="addressform" onSubmit={this.handleSubmit} hidden >
              <input id="setaddress" type="hidden" onChange={this.setAddress}/>
              <input id="submitaddress" type='submit' value='Submit' />
            </form>
            <div id="mydiv" dangerouslySetInnerHTML={setAddressScript()} />
          </Grid>
        </Grid>
      </>
    );
  }
}

export default withStyles(styles)(Onboarding);
