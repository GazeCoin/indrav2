import { Button, Grid, withStyles, TextField } from "@material-ui/core";
import React from "react";

import "../App.css";

const styles = {};

class RequestGrant extends React.Component {

  handleSubmit = (e) => {
    e.preventDefault();
    const ethaddress = this.props.ethAddress;
    console.log('have ethaddress: ', ethaddress);
    // Send
    fetch('https://adbot.gazecoin.xyz/requestgrant/' + ethaddress);
    //  .then();
    // var store = this.state.store;
    // if (store) {
    //   store.set([ {path: 'ethAddress', value: address }]);
    // }
  }

  render() {
    //const { address } = this.props;
    //const { store, channel } = this.state;
    return (
      <>
        <Grid
          container
          spacing={20}
          direction="column"
          style={{ paddingLeft: "2%", paddingRight: "2%", textAlign: "center" }}
        >
          <Grid item xs={12}>
            <TextField
              id="standard-multiline-flexible"
              value="Claim your free credits here"
            />
          </Grid>
          <Grid item xs={12}>
            <Button
              style={{ marginBottom: "5%" }}
              fullWidth
              color="primary"
              variant="outlined"
              size="large"
              onClick={this.handleSubmit}
            >
              Request Credits
            </Button>
          </Grid>
        </Grid>
      </>
    );
  }
}

export default withStyles(styles)(RequestGrant);
