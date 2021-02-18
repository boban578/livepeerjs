import { Flex, Styled } from "theme-ui";
import { Text } from "@theme-ui/components";
import { getLayout } from "../../layouts/main";
import fm from "front-matter";
import IPFS from "ipfs-mini";
import { Box } from "theme-ui";
import Card from "../../components/Card";
import VotingWidget from "../../components/VotingWidget";
import ReactMarkdown from "react-markdown";
import { abbreviateNumber } from "../../lib/utils";
import { withApollo } from "../../apollo";
import { useRouter } from "next/router";
import { useQuery, useApolloClient, gql } from "@apollo/client";
import { useWeb3React } from "@web3-react/core";
import Spinner from "../../components/Spinner";
import { useEffect, useState } from "react";
import moment from "moment";
import { useWindowSize } from "react-use";
import BottomDrawer from "../../components/BottomDrawer";
import Button from "../../components/Button";
import Head from "next/head";
import { usePageVisibility } from "../../hooks";
import pollQuery from "../../queries/poll.gql";
import accountQuery from "../../queries/account.gql";
import voteQuery from "../../queries/vote.gql";
import FourZeroFour from "../404";
import { NextPage } from "next";

const Poll = () => {
  const router = useRouter();
  const context = useWeb3React();
  const client = useApolloClient();
  const { width } = useWindowSize();
  const isVisible = usePageVisibility();
  const [pollData, setPollData] = useState(null);
  const { query } = router;

  const pollId = query.poll.toString().toLowerCase();
  const pollInterval = 20000;

  const {
    data,
    startPolling: startPollingPoll,
    stopPolling: stopPollingPoll,
  } = useQuery(pollQuery, {
    variables: {
      id: pollId,
    },
    pollInterval,
  });

  const {
    data: myAccountData,
    startPolling: startPollingMyAccount,
    stopPolling: stopPollingMyAccount,
  } = useQuery(accountQuery, {
    variables: {
      account: context?.account?.toLowerCase(),
    },
    pollInterval,
    skip: !context.active,
  });

  const {
    data: voteData,
    startPolling: startPollingVote,
    stopPolling: stopPollingVote,
  } = useQuery(voteQuery, {
    variables: {
      id: `${context?.account?.toLowerCase()}-${pollId}`,
    },
    pollInterval,
    skip: !context.active,
  });

  const {
    data: delegateVoteData,
    startPolling: startPollingDelegate,
    stopPolling: stopPollingDelegate,
  } = useQuery(voteQuery, {
    variables: {
      id: `${myAccountData?.delegator?.delegate?.id.toLowerCase()}-${pollId}`,
    },
    pollInterval,
    skip: !myAccountData?.delegator?.delegate,
  });

  useEffect(() => {
    if (!isVisible) {
      stopPollingPoll();
      stopPollingMyAccount();
      stopPollingVote();
      stopPollingDelegate();
    } else {
      startPollingPoll(pollInterval);
      startPollingMyAccount(pollInterval);
      startPollingVote(pollInterval);
      startPollingDelegate(pollInterval);
    }
  }, [
    isVisible,
    stopPollingPoll,
    stopPollingMyAccount,
    stopPollingVote,
    stopPollingDelegate,
    startPollingPoll,
    startPollingMyAccount,
    startPollingVote,
    startPollingDelegate,
  ]);

  useEffect(() => {
    const init = async () => {
      if (data) {
        const response = await transformData({
          poll: data.poll,
        });
        setPollData(response);
      }
    };
    init();
  }, [data]);

  if (!query?.poll) {
    return <FourZeroFour />;
  }

  if (!pollData) {
    return (
      <Flex
        sx={{
          height: [
            "calc(100vh - 100px)",
            "calc(100vh - 100px)",
            "calc(100vh - 100px)",
            "100vh",
          ],
          width: "100%",
          justifyContent: "center",
          alignItems: "center",
        }}>
        <Spinner />
      </Flex>
    );
  }

  const noVoteStake = +pollData?.tally?.no || 0;
  const yesVoteStake = +pollData?.tally?.yes || 0;
  const totalVoteStake = noVoteStake + yesVoteStake;

  return (
    <>
      <Head>
        <title>Livepeer Explorer - Voting</title>
      </Head>
      <Flex sx={{ width: "100%" }}>
        <Flex
          sx={{
            mt: [0, 0, 0, 5],
            pr: [0, 0, 0, 6],
            width: "100%",
            flexDirection: "column",
          }}>
          <Box sx={{ mb: 4, width: "100%" }}>
            <Flex
              sx={{
                mb: 1,
                alignItems: "center",
              }}>
              <Box sx={{ mr: 1 }}>Status:</Box>
              <Text
                variant={pollData.status}
                sx={{ textTransform: "capitalize", fontWeight: 700 }}>
                {pollData.status}
              </Text>
            </Flex>
            <Styled.h1
              sx={{
                fontSize: [3, 3, 26],
                display: "flex",
                mb: "10px",
                alignItems: "center",
              }}>
              {pollData.title} (LIP-{pollData.lip})
            </Styled.h1>
            <Box sx={{ fontSize: 0, color: "muted" }}>
              {!pollData.isActive ? (
                <Box>
                  Voting ended on{" "}
                  {moment.unix(pollData.endTime).format("MMM Do, YYYY")} at
                  block {pollData.endBlock}
                </Box>
              ) : (
                <Box>
                  Voting ends in ~
                  {moment()
                    .add(pollData.estimatedTimeRemaining, "seconds")
                    .fromNow(true)}
                </Box>
              )}
            </Box>
            {pollData.isActive && (
              <Button
                sx={{ display: ["flex", "flex", "flex", "none"], mt: 2, mr: 2 }}
                onClick={() =>
                  client.writeQuery({
                    query: gql`
                      query {
                        bottomDrawerOpen
                      }
                    `,
                    data: {
                      bottomDrawerOpen: true,
                    },
                  })
                }>
                Vote
              </Button>
            )}
          </Box>

          <Box>
            <Box
              sx={{
                display: "grid",
                gridGap: 2,
                gridTemplateColumns: [
                  "100%",
                  "100%",
                  `repeat(auto-fit, minmax(128px, 1fr))`,
                ],
                mb: 2,
              }}>
              <Card
                sx={{ flex: 1, mb: 0 }}
                title={
                  <Flex sx={{ alignItems: "center" }}>
                    <Box sx={{ color: "muted" }}>
                      Total Support ({pollData.quota / 10000}% needed)
                    </Box>
                  </Flex>
                }
                subtitle={
                  <Box
                    sx={{
                      fontSize: 5,
                      color: "text",
                      lineHeight: "heading",
                    }}>
                    {pollData.totalSupport.toPrecision(5)}%
                  </Box>
                }>
                <Box sx={{ mt: 3 }}>
                  <Flex
                    sx={{
                      fontSize: 1,
                      mb: 1,
                      justifyContent: "space-between",
                    }}>
                    <Flex sx={{ alignItems: "center" }}>
                      <Box sx={{ color: "muted" }}>
                        Yes (
                        {isNaN(yesVoteStake / totalVoteStake)
                          ? 0
                          : ((yesVoteStake / totalVoteStake) * 100).toPrecision(
                              5
                            )}
                        %)
                      </Box>
                    </Flex>
                    <span sx={{ fontFamily: "monospace" }}>
                      {abbreviateNumber(yesVoteStake, 4)} LPT
                    </span>
                  </Flex>
                  <Flex
                    sx={{
                      fontSize: 1,
                      justifyContent: "space-between",
                    }}>
                    <Flex sx={{ alignItems: "center" }}>
                      <Box sx={{ color: "muted" }}>
                        No (
                        {isNaN(noVoteStake / totalVoteStake)
                          ? 0
                          : ((noVoteStake / totalVoteStake) * 100).toPrecision(
                              5
                            )}
                        %)
                      </Box>
                    </Flex>
                    <span sx={{ fontFamily: "monospace" }}>
                      {abbreviateNumber(noVoteStake, 4)} LPT
                    </span>
                  </Flex>
                </Box>
              </Card>

              <Card
                sx={{ flex: 1, mb: 0 }}
                title={
                  <Flex sx={{ alignItems: "center" }}>
                    <Box sx={{ color: "muted" }}>
                      Total Participation ({pollData.quorum / 10000}% needed)
                    </Box>
                  </Flex>
                }
                subtitle={
                  <Box
                    sx={{
                      fontSize: 5,
                      color: "text",
                      lineHeight: "heading",
                    }}>
                    {pollData.totalParticipation.toPrecision(5)}%
                  </Box>
                }>
                <Box sx={{ mt: 3 }}>
                  <Flex
                    sx={{
                      fontSize: 1,
                      mb: 1,
                      justifyContent: "space-between",
                    }}>
                    <span sx={{ color: "muted" }}>
                      Voters ({pollData.totalParticipation.toPrecision(5)}
                      %)
                    </span>
                    <span>
                      <span sx={{ fontFamily: "monospace" }}>
                        {abbreviateNumber(totalVoteStake, 4)} LPT
                      </span>
                    </span>
                  </Flex>
                  <Flex sx={{ fontSize: 1, justifyContent: "space-between" }}>
                    <span sx={{ color: "muted" }}>
                      Nonvoters ({pollData.nonVoters.toPrecision(5)}
                      %)
                    </span>
                    <span>
                      <span sx={{ fontFamily: "monospace" }}>
                        {abbreviateNumber(pollData.nonVotersStake, 4)} LPT
                      </span>
                    </span>
                  </Flex>
                </Box>
              </Card>
            </Box>
            <Card
              sx={{
                mb: 2,
                h2: { ":first-of-type": { mt: 0 }, mt: 2 },
                h3: { mt: 2 },
                h4: { mt: 2 },
                h5: { mt: 2 },
              }}>
              <ReactMarkdown source={pollData.text} />
            </Card>
          </Box>
        </Flex>

        {width > 1020 ? (
          <Flex
            sx={{
              display: ["none", "none", "none", "flex"],
              position: "sticky",
              alignSelf: "flex-start",
              top: 5,
              mt: 3,
              minWidth: "31%",
            }}>
            <VotingWidget
              data={{
                poll: pollData,
                delegateVote: delegateVoteData?.vote,
                vote: voteData?.vote,
                myAccount: myAccountData,
              }}
            />
          </Flex>
        ) : (
          <BottomDrawer>
            <VotingWidget
              data={{
                poll: pollData,
                delegateVote: delegateVoteData?.vote,
                vote: voteData?.vote,
                myAccount: myAccountData,
              }}
            />
          </BottomDrawer>
        )}
      </Flex>
    </>
  );
};

async function transformData({ poll }) {
  const noVoteStake = +poll?.tally?.no || 0;
  const yesVoteStake = +poll?.tally?.yes || 0;
  const totalVoteStake = +poll?.totalVoteStake;
  const totalNonVoteStake = +poll?.totalNonVoteStake;
  const totalSupport = isNaN(yesVoteStake / totalVoteStake)
    ? 0
    : (yesVoteStake / totalVoteStake) * 100;
  const totalStake = totalNonVoteStake + totalVoteStake;
  const totalParticipation = (totalVoteStake / totalStake) * 100;
  const nonVotersStake = totalStake - totalVoteStake;
  const nonVoters = ((totalStake - totalVoteStake) / totalStake) * 100;

  const ipfs = new IPFS({
    host: "ipfs.infura.io",
    port: 5001,
    protocol: "https",
  });
  const { gitCommitHash, text } = await ipfs.catJSON(poll.proposal);
  const response = fm(text);
  return {
    ...response.attributes,
    created: response.attributes.created.toString(),
    text: response.body,
    gitCommitHash,
    totalStake,
    totalSupport,
    totalParticipation,
    nonVoters,
    nonVotersStake,
    yesVoteStake,
    noVoteStake,
    ...poll,
  };
}

Poll.getLayout = getLayout;

export default withApollo({
  ssr: true,
})(Poll as NextPage);
