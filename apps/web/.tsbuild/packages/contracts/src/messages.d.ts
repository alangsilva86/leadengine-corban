import { z } from 'zod';
import type { components } from './types.gen.js';
type MessagePayloadContract = components['schemas']['MessagePayload'];
type SendMessageByTicketContract = components['schemas']['SendMessageByTicketRequest'];
type SendMessageByContactContract = components['schemas']['SendMessageByContactRequest'];
type SendMessageByInstanceContract = components['schemas']['SendMessageByInstanceRequest'];
type OutboundMessageResponseContract = components['schemas']['OutboundMessageResponse'];
type OutboundMessageErrorContract = components['schemas']['OutboundMessageError'];
export declare const PollMetadataSchema: z.ZodObject<{
    origin: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    poll: z.ZodOptional<z.ZodOptional<z.ZodObject<{
        id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        question: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        updatedAt: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        timestamp: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        options: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
        selectedOptions: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
        aggregates: z.ZodOptional<z.ZodOptional<z.ZodObject<{
            totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
        }, z.ZodTypeAny, "passthrough">>>>;
        optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        question: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        updatedAt: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        timestamp: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        options: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
        selectedOptions: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
        aggregates: z.ZodOptional<z.ZodOptional<z.ZodObject<{
            totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
        }, z.ZodTypeAny, "passthrough">>>>;
        optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        question: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        updatedAt: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        timestamp: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        options: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
        selectedOptions: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
        aggregates: z.ZodOptional<z.ZodOptional<z.ZodObject<{
            totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
        }, z.ZodTypeAny, "passthrough">>>>;
        optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
    }, z.ZodTypeAny, "passthrough">>>>;
    pollChoice: z.ZodOptional<z.ZodOptional<z.ZodObject<{
        id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        vote: z.ZodOptional<z.ZodOptional<z.ZodObject<{
            timestamp: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            selectedOptions: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
            optionIds: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            timestamp: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            selectedOptions: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
            optionIds: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            timestamp: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            selectedOptions: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
            optionIds: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
        }, z.ZodTypeAny, "passthrough">>>>;
        options: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        vote: z.ZodOptional<z.ZodOptional<z.ZodObject<{
            timestamp: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            selectedOptions: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
            optionIds: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            timestamp: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            selectedOptions: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
            optionIds: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            timestamp: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            selectedOptions: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
            optionIds: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
        }, z.ZodTypeAny, "passthrough">>>>;
        options: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        vote: z.ZodOptional<z.ZodOptional<z.ZodObject<{
            timestamp: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            selectedOptions: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
            optionIds: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            timestamp: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            selectedOptions: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
            optionIds: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            timestamp: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            selectedOptions: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
            optionIds: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
        }, z.ZodTypeAny, "passthrough">>>>;
        options: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
    }, z.ZodTypeAny, "passthrough">>>>;
    interactive: z.ZodOptional<z.ZodOptional<z.ZodObject<{
        poll: z.ZodOptional<z.ZodOptional<z.ZodObject<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            question: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            updatedAt: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            timestamp: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            options: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
            selectedOptions: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
            aggregates: z.ZodOptional<z.ZodOptional<z.ZodObject<{
                totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
            }, z.ZodTypeAny, "passthrough">>>>;
            optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            question: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            updatedAt: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            timestamp: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            options: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
            selectedOptions: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
            aggregates: z.ZodOptional<z.ZodOptional<z.ZodObject<{
                totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
            }, z.ZodTypeAny, "passthrough">>>>;
            optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            question: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            updatedAt: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            timestamp: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            options: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
            selectedOptions: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
            aggregates: z.ZodOptional<z.ZodOptional<z.ZodObject<{
                totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
            }, z.ZodTypeAny, "passthrough">>>>;
            optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
        }, z.ZodTypeAny, "passthrough">>>>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        poll: z.ZodOptional<z.ZodOptional<z.ZodObject<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            question: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            updatedAt: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            timestamp: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            options: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
            selectedOptions: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
            aggregates: z.ZodOptional<z.ZodOptional<z.ZodObject<{
                totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
            }, z.ZodTypeAny, "passthrough">>>>;
            optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            question: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            updatedAt: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            timestamp: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            options: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
            selectedOptions: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
            aggregates: z.ZodOptional<z.ZodOptional<z.ZodObject<{
                totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
            }, z.ZodTypeAny, "passthrough">>>>;
            optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            question: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            updatedAt: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            timestamp: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            options: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
            selectedOptions: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
            aggregates: z.ZodOptional<z.ZodOptional<z.ZodObject<{
                totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
            }, z.ZodTypeAny, "passthrough">>>>;
            optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
        }, z.ZodTypeAny, "passthrough">>>>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        poll: z.ZodOptional<z.ZodOptional<z.ZodObject<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            question: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            updatedAt: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            timestamp: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            options: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
            selectedOptions: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
            aggregates: z.ZodOptional<z.ZodOptional<z.ZodObject<{
                totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
            }, z.ZodTypeAny, "passthrough">>>>;
            optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            question: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            updatedAt: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            timestamp: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            options: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
            selectedOptions: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
            aggregates: z.ZodOptional<z.ZodOptional<z.ZodObject<{
                totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
            }, z.ZodTypeAny, "passthrough">>>>;
            optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            question: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            updatedAt: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            timestamp: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            options: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
            selectedOptions: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
            aggregates: z.ZodOptional<z.ZodOptional<z.ZodObject<{
                totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
            }, z.ZodTypeAny, "passthrough">>>>;
            optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
        }, z.ZodTypeAny, "passthrough">>>>;
    }, z.ZodTypeAny, "passthrough">>>>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    origin: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    poll: z.ZodOptional<z.ZodOptional<z.ZodObject<{
        id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        question: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        updatedAt: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        timestamp: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        options: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
        selectedOptions: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
        aggregates: z.ZodOptional<z.ZodOptional<z.ZodObject<{
            totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
        }, z.ZodTypeAny, "passthrough">>>>;
        optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        question: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        updatedAt: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        timestamp: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        options: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
        selectedOptions: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
        aggregates: z.ZodOptional<z.ZodOptional<z.ZodObject<{
            totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
        }, z.ZodTypeAny, "passthrough">>>>;
        optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        question: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        updatedAt: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        timestamp: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        options: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
        selectedOptions: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
        aggregates: z.ZodOptional<z.ZodOptional<z.ZodObject<{
            totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
        }, z.ZodTypeAny, "passthrough">>>>;
        optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
    }, z.ZodTypeAny, "passthrough">>>>;
    pollChoice: z.ZodOptional<z.ZodOptional<z.ZodObject<{
        id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        vote: z.ZodOptional<z.ZodOptional<z.ZodObject<{
            timestamp: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            selectedOptions: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
            optionIds: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            timestamp: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            selectedOptions: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
            optionIds: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            timestamp: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            selectedOptions: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
            optionIds: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
        }, z.ZodTypeAny, "passthrough">>>>;
        options: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        vote: z.ZodOptional<z.ZodOptional<z.ZodObject<{
            timestamp: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            selectedOptions: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
            optionIds: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            timestamp: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            selectedOptions: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
            optionIds: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            timestamp: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            selectedOptions: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
            optionIds: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
        }, z.ZodTypeAny, "passthrough">>>>;
        options: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        vote: z.ZodOptional<z.ZodOptional<z.ZodObject<{
            timestamp: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            selectedOptions: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
            optionIds: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            timestamp: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            selectedOptions: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
            optionIds: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            timestamp: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            selectedOptions: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
            optionIds: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
        }, z.ZodTypeAny, "passthrough">>>>;
        options: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
    }, z.ZodTypeAny, "passthrough">>>>;
    interactive: z.ZodOptional<z.ZodOptional<z.ZodObject<{
        poll: z.ZodOptional<z.ZodOptional<z.ZodObject<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            question: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            updatedAt: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            timestamp: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            options: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
            selectedOptions: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
            aggregates: z.ZodOptional<z.ZodOptional<z.ZodObject<{
                totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
            }, z.ZodTypeAny, "passthrough">>>>;
            optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            question: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            updatedAt: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            timestamp: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            options: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
            selectedOptions: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
            aggregates: z.ZodOptional<z.ZodOptional<z.ZodObject<{
                totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
            }, z.ZodTypeAny, "passthrough">>>>;
            optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            question: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            updatedAt: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            timestamp: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            options: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
            selectedOptions: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
            aggregates: z.ZodOptional<z.ZodOptional<z.ZodObject<{
                totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
            }, z.ZodTypeAny, "passthrough">>>>;
            optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
        }, z.ZodTypeAny, "passthrough">>>>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        poll: z.ZodOptional<z.ZodOptional<z.ZodObject<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            question: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            updatedAt: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            timestamp: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            options: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
            selectedOptions: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
            aggregates: z.ZodOptional<z.ZodOptional<z.ZodObject<{
                totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
            }, z.ZodTypeAny, "passthrough">>>>;
            optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            question: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            updatedAt: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            timestamp: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            options: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
            selectedOptions: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
            aggregates: z.ZodOptional<z.ZodOptional<z.ZodObject<{
                totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
            }, z.ZodTypeAny, "passthrough">>>>;
            optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            question: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            updatedAt: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            timestamp: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            options: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
            selectedOptions: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
            aggregates: z.ZodOptional<z.ZodOptional<z.ZodObject<{
                totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
            }, z.ZodTypeAny, "passthrough">>>>;
            optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
        }, z.ZodTypeAny, "passthrough">>>>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        poll: z.ZodOptional<z.ZodOptional<z.ZodObject<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            question: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            updatedAt: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            timestamp: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            options: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
            selectedOptions: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
            aggregates: z.ZodOptional<z.ZodOptional<z.ZodObject<{
                totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
            }, z.ZodTypeAny, "passthrough">>>>;
            optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            question: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            updatedAt: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            timestamp: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            options: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
            selectedOptions: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
            aggregates: z.ZodOptional<z.ZodOptional<z.ZodObject<{
                totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
            }, z.ZodTypeAny, "passthrough">>>>;
            optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            question: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            updatedAt: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            timestamp: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            options: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
            selectedOptions: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
            aggregates: z.ZodOptional<z.ZodOptional<z.ZodObject<{
                totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
            }, z.ZodTypeAny, "passthrough">>>>;
            optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
        }, z.ZodTypeAny, "passthrough">>>>;
    }, z.ZodTypeAny, "passthrough">>>>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    origin: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    poll: z.ZodOptional<z.ZodOptional<z.ZodObject<{
        id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        question: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        updatedAt: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        timestamp: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        options: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
        selectedOptions: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
        aggregates: z.ZodOptional<z.ZodOptional<z.ZodObject<{
            totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
        }, z.ZodTypeAny, "passthrough">>>>;
        optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        question: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        updatedAt: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        timestamp: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        options: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
        selectedOptions: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
        aggregates: z.ZodOptional<z.ZodOptional<z.ZodObject<{
            totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
        }, z.ZodTypeAny, "passthrough">>>>;
        optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        question: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        updatedAt: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        timestamp: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        options: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
        selectedOptions: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
        aggregates: z.ZodOptional<z.ZodOptional<z.ZodObject<{
            totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
        }, z.ZodTypeAny, "passthrough">>>>;
        optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
    }, z.ZodTypeAny, "passthrough">>>>;
    pollChoice: z.ZodOptional<z.ZodOptional<z.ZodObject<{
        id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        vote: z.ZodOptional<z.ZodOptional<z.ZodObject<{
            timestamp: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            selectedOptions: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
            optionIds: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            timestamp: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            selectedOptions: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
            optionIds: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            timestamp: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            selectedOptions: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
            optionIds: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
        }, z.ZodTypeAny, "passthrough">>>>;
        options: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        vote: z.ZodOptional<z.ZodOptional<z.ZodObject<{
            timestamp: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            selectedOptions: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
            optionIds: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            timestamp: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            selectedOptions: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
            optionIds: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            timestamp: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            selectedOptions: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
            optionIds: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
        }, z.ZodTypeAny, "passthrough">>>>;
        options: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        vote: z.ZodOptional<z.ZodOptional<z.ZodObject<{
            timestamp: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            selectedOptions: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
            optionIds: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            timestamp: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            selectedOptions: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
            optionIds: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            timestamp: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            selectedOptions: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
            optionIds: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
        }, z.ZodTypeAny, "passthrough">>>>;
        options: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
    }, z.ZodTypeAny, "passthrough">>>>;
    interactive: z.ZodOptional<z.ZodOptional<z.ZodObject<{
        poll: z.ZodOptional<z.ZodOptional<z.ZodObject<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            question: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            updatedAt: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            timestamp: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            options: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
            selectedOptions: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
            aggregates: z.ZodOptional<z.ZodOptional<z.ZodObject<{
                totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
            }, z.ZodTypeAny, "passthrough">>>>;
            optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            question: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            updatedAt: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            timestamp: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            options: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
            selectedOptions: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
            aggregates: z.ZodOptional<z.ZodOptional<z.ZodObject<{
                totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
            }, z.ZodTypeAny, "passthrough">>>>;
            optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            question: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            updatedAt: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            timestamp: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            options: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
            selectedOptions: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
            aggregates: z.ZodOptional<z.ZodOptional<z.ZodObject<{
                totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
            }, z.ZodTypeAny, "passthrough">>>>;
            optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
        }, z.ZodTypeAny, "passthrough">>>>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        poll: z.ZodOptional<z.ZodOptional<z.ZodObject<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            question: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            updatedAt: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            timestamp: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            options: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
            selectedOptions: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
            aggregates: z.ZodOptional<z.ZodOptional<z.ZodObject<{
                totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
            }, z.ZodTypeAny, "passthrough">>>>;
            optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            question: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            updatedAt: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            timestamp: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            options: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
            selectedOptions: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
            aggregates: z.ZodOptional<z.ZodOptional<z.ZodObject<{
                totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
            }, z.ZodTypeAny, "passthrough">>>>;
            optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            question: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            updatedAt: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            timestamp: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            options: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
            selectedOptions: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
            aggregates: z.ZodOptional<z.ZodOptional<z.ZodObject<{
                totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
            }, z.ZodTypeAny, "passthrough">>>>;
            optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
        }, z.ZodTypeAny, "passthrough">>>>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        poll: z.ZodOptional<z.ZodOptional<z.ZodObject<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            question: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            updatedAt: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            timestamp: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            options: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
            selectedOptions: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
            aggregates: z.ZodOptional<z.ZodOptional<z.ZodObject<{
                totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
            }, z.ZodTypeAny, "passthrough">>>>;
            optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            question: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            updatedAt: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            timestamp: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            options: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
            selectedOptions: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
            aggregates: z.ZodOptional<z.ZodOptional<z.ZodObject<{
                totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
            }, z.ZodTypeAny, "passthrough">>>>;
            optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            question: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            updatedAt: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            timestamp: z.ZodOptional<z.ZodOptional<z.ZodString>>;
            totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            options: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
            selectedOptions: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodObject<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                id: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                pollId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                value: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                title: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                text: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                name: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                optionName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                label: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                displayName: z.ZodOptional<z.ZodOptional<z.ZodString>>;
                index: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                position: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                votes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                count: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            }, z.ZodTypeAny, "passthrough">>]>, "many">>>;
            aggregates: z.ZodOptional<z.ZodOptional<z.ZodObject<{
                totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
            }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
                totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
            }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
                totalVotes: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                totalVoters: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
            }, z.ZodTypeAny, "passthrough">>>>;
            optionTotals: z.ZodOptional<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNumber>>>;
        }, z.ZodTypeAny, "passthrough">>>>;
    }, z.ZodTypeAny, "passthrough">>>>;
}, z.ZodTypeAny, "passthrough">>;
declare const LocationDescriptorSchema: z.ZodObject<{
    latitude: z.ZodNumber;
    longitude: z.ZodNumber;
    name: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
    address: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
    url: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    latitude: number;
    longitude: number;
    name?: string | undefined;
    url?: string | undefined;
    address?: string | undefined;
}, {
    latitude: number;
    longitude: number;
    name?: string | undefined;
    url?: string | undefined;
    address?: string | undefined;
}>;
declare const ContactDescriptorSchema: z.ZodEffects<z.ZodObject<{
    fullName: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
    organization: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
    emails: z.ZodOptional<z.ZodArray<z.ZodObject<{
        email: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
        type: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
    }, "strict", z.ZodTypeAny, {
        email: string;
        type?: string | undefined;
    }, {
        email: string;
        type?: string | undefined;
    }>, "many">>;
    phones: z.ZodOptional<z.ZodArray<z.ZodObject<{
        phoneNumber: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
        type: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
        waId: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
    }, "strict", z.ZodTypeAny, {
        phoneNumber: string;
        type?: string | undefined;
        waId?: string | undefined;
    }, {
        phoneNumber: string;
        type?: string | undefined;
        waId?: string | undefined;
    }>, "many">>;
    vcard: z.ZodOptional<z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>>;
}, "strict", z.ZodTypeAny, {
    organization?: string | undefined;
    fullName?: string | undefined;
    emails?: {
        email: string;
        type?: string | undefined;
    }[] | undefined;
    phones?: {
        phoneNumber: string;
        type?: string | undefined;
        waId?: string | undefined;
    }[] | undefined;
    vcard?: string | undefined;
}, {
    organization?: string | undefined;
    fullName?: string | undefined;
    emails?: {
        email: string;
        type?: string | undefined;
    }[] | undefined;
    phones?: {
        phoneNumber: string;
        type?: string | undefined;
        waId?: string | undefined;
    }[] | undefined;
    vcard?: string | undefined;
}>, {
    organization?: string | undefined;
    fullName?: string | undefined;
    emails?: {
        email: string;
        type?: string | undefined;
    }[] | undefined;
    phones?: {
        phoneNumber: string;
        type?: string | undefined;
        waId?: string | undefined;
    }[] | undefined;
    vcard?: string | undefined;
}, {
    organization?: string | undefined;
    fullName?: string | undefined;
    emails?: {
        email: string;
        type?: string | undefined;
    }[] | undefined;
    phones?: {
        phoneNumber: string;
        type?: string | undefined;
        waId?: string | undefined;
    }[] | undefined;
    vcard?: string | undefined;
}>;
declare const TemplateDescriptorSchema: z.ZodObject<{
    namespace: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
    name: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
    language: z.ZodObject<{
        code: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
        policy: z.ZodOptional<z.ZodEnum<["deterministic", "fallback"]>>;
    }, "strict", z.ZodTypeAny, {
        code: string;
        policy?: "fallback" | "deterministic" | undefined;
    }, {
        code: string;
        policy?: "fallback" | "deterministic" | undefined;
    }>;
    components: z.ZodOptional<z.ZodArray<z.ZodEffects<z.ZodObject<{
        type: z.ZodEnum<["header", "body", "footer", "button"]>;
        subType: z.ZodOptional<z.ZodEnum<["quick_reply", "url", "copy_code", "phone_number"]>>;
        index: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
        parameters: z.ZodOptional<z.ZodArray<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
            type: z.ZodLiteral<"text">;
            text: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
        }, "strict", z.ZodTypeAny, {
            type: "text";
            text: string;
        }, {
            type: "text";
            text: string;
        }>, z.ZodObject<{
            type: z.ZodLiteral<"currency">;
            currency: z.ZodObject<{
                amount1000: z.ZodNumber;
                currencyCode: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
            }, "strict", z.ZodTypeAny, {
                amount1000: number;
                currencyCode: string;
            }, {
                amount1000: number;
                currencyCode: string;
            }>;
        }, "strict", z.ZodTypeAny, {
            type: "currency";
            currency: {
                amount1000: number;
                currencyCode: string;
            };
        }, {
            type: "currency";
            currency: {
                amount1000: number;
                currencyCode: string;
            };
        }>, z.ZodObject<{
            type: z.ZodLiteral<"date_time">;
            dateTime: z.ZodEffects<z.ZodObject<{
                fallbackValue: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
                timestamp: z.ZodOptional<z.ZodNumber>;
            }, "strict", z.ZodTypeAny, {
                timestamp?: number | undefined;
                fallbackValue?: string | undefined;
            }, {
                timestamp?: number | undefined;
                fallbackValue?: string | undefined;
            }>, {
                timestamp?: number | undefined;
                fallbackValue?: string | undefined;
            }, {
                timestamp?: number | undefined;
                fallbackValue?: string | undefined;
            }>;
        }, "strict", z.ZodTypeAny, {
            type: "date_time";
            dateTime: {
                timestamp?: number | undefined;
                fallbackValue?: string | undefined;
            };
        }, {
            type: "date_time";
            dateTime: {
                timestamp?: number | undefined;
                fallbackValue?: string | undefined;
            };
        }>, z.ZodObject<{
            type: z.ZodLiteral<"image">;
            image: z.ZodObject<{
                link: z.ZodString;
            }, "strict", z.ZodTypeAny, {
                link: string;
            }, {
                link: string;
            }>;
        }, "strict", z.ZodTypeAny, {
            type: "image";
            image: {
                link: string;
            };
        }, {
            type: "image";
            image: {
                link: string;
            };
        }>, z.ZodObject<{
            type: z.ZodLiteral<"document">;
            document: z.ZodObject<{
                link: z.ZodString;
                filename: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
            }, "strict", z.ZodTypeAny, {
                link: string;
                filename?: string | undefined;
            }, {
                link: string;
                filename?: string | undefined;
            }>;
        }, "strict", z.ZodTypeAny, {
            type: "document";
            document: {
                link: string;
                filename?: string | undefined;
            };
        }, {
            type: "document";
            document: {
                link: string;
                filename?: string | undefined;
            };
        }>, z.ZodObject<{
            type: z.ZodLiteral<"video">;
            video: z.ZodObject<{
                link: z.ZodString;
            }, "strict", z.ZodTypeAny, {
                link: string;
            }, {
                link: string;
            }>;
        }, "strict", z.ZodTypeAny, {
            type: "video";
            video: {
                link: string;
            };
        }, {
            type: "video";
            video: {
                link: string;
            };
        }>]>, "many">>;
    }, "strict", z.ZodTypeAny, {
        type: "button" | "body" | "footer" | "header";
        index?: string | undefined;
        subType?: "url" | "phone_number" | "quick_reply" | "copy_code" | undefined;
        parameters?: ({
            type: "text";
            text: string;
        } | {
            type: "currency";
            currency: {
                amount1000: number;
                currencyCode: string;
            };
        } | {
            type: "date_time";
            dateTime: {
                timestamp?: number | undefined;
                fallbackValue?: string | undefined;
            };
        } | {
            type: "image";
            image: {
                link: string;
            };
        } | {
            type: "document";
            document: {
                link: string;
                filename?: string | undefined;
            };
        } | {
            type: "video";
            video: {
                link: string;
            };
        })[] | undefined;
    }, {
        type: "button" | "body" | "footer" | "header";
        index?: string | undefined;
        subType?: "url" | "phone_number" | "quick_reply" | "copy_code" | undefined;
        parameters?: ({
            type: "text";
            text: string;
        } | {
            type: "currency";
            currency: {
                amount1000: number;
                currencyCode: string;
            };
        } | {
            type: "date_time";
            dateTime: {
                timestamp?: number | undefined;
                fallbackValue?: string | undefined;
            };
        } | {
            type: "image";
            image: {
                link: string;
            };
        } | {
            type: "document";
            document: {
                link: string;
                filename?: string | undefined;
            };
        } | {
            type: "video";
            video: {
                link: string;
            };
        })[] | undefined;
    }>, {
        type: "button" | "body" | "footer" | "header";
        index?: string | undefined;
        subType?: "url" | "phone_number" | "quick_reply" | "copy_code" | undefined;
        parameters?: ({
            type: "text";
            text: string;
        } | {
            type: "currency";
            currency: {
                amount1000: number;
                currencyCode: string;
            };
        } | {
            type: "date_time";
            dateTime: {
                timestamp?: number | undefined;
                fallbackValue?: string | undefined;
            };
        } | {
            type: "image";
            image: {
                link: string;
            };
        } | {
            type: "document";
            document: {
                link: string;
                filename?: string | undefined;
            };
        } | {
            type: "video";
            video: {
                link: string;
            };
        })[] | undefined;
    }, {
        type: "button" | "body" | "footer" | "header";
        index?: string | undefined;
        subType?: "url" | "phone_number" | "quick_reply" | "copy_code" | undefined;
        parameters?: ({
            type: "text";
            text: string;
        } | {
            type: "currency";
            currency: {
                amount1000: number;
                currencyCode: string;
            };
        } | {
            type: "date_time";
            dateTime: {
                timestamp?: number | undefined;
                fallbackValue?: string | undefined;
            };
        } | {
            type: "image";
            image: {
                link: string;
            };
        } | {
            type: "document";
            document: {
                link: string;
                filename?: string | undefined;
            };
        } | {
            type: "video";
            video: {
                link: string;
            };
        })[] | undefined;
    }>, "many">>;
}, "strict", z.ZodTypeAny, {
    name: string;
    namespace: string;
    language: {
        code: string;
        policy?: "fallback" | "deterministic" | undefined;
    };
    components?: {
        type: "button" | "body" | "footer" | "header";
        index?: string | undefined;
        subType?: "url" | "phone_number" | "quick_reply" | "copy_code" | undefined;
        parameters?: ({
            type: "text";
            text: string;
        } | {
            type: "currency";
            currency: {
                amount1000: number;
                currencyCode: string;
            };
        } | {
            type: "date_time";
            dateTime: {
                timestamp?: number | undefined;
                fallbackValue?: string | undefined;
            };
        } | {
            type: "image";
            image: {
                link: string;
            };
        } | {
            type: "document";
            document: {
                link: string;
                filename?: string | undefined;
            };
        } | {
            type: "video";
            video: {
                link: string;
            };
        })[] | undefined;
    }[] | undefined;
}, {
    name: string;
    namespace: string;
    language: {
        code: string;
        policy?: "fallback" | "deterministic" | undefined;
    };
    components?: {
        type: "button" | "body" | "footer" | "header";
        index?: string | undefined;
        subType?: "url" | "phone_number" | "quick_reply" | "copy_code" | undefined;
        parameters?: ({
            type: "text";
            text: string;
        } | {
            type: "currency";
            currency: {
                amount1000: number;
                currencyCode: string;
            };
        } | {
            type: "date_time";
            dateTime: {
                timestamp?: number | undefined;
                fallbackValue?: string | undefined;
            };
        } | {
            type: "image";
            image: {
                link: string;
            };
        } | {
            type: "document";
            document: {
                link: string;
                filename?: string | undefined;
            };
        } | {
            type: "video";
            video: {
                link: string;
            };
        })[] | undefined;
    }[] | undefined;
}>;
declare const PollDefinitionSchema: z.ZodObject<{
    question: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
    options: z.ZodArray<z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>, "many">;
    allowMultipleAnswers: z.ZodOptional<z.ZodBoolean>;
}, "strict", z.ZodTypeAny, {
    options: string[];
    question: string;
    allowMultipleAnswers?: boolean | undefined;
}, {
    options: string[];
    question: string;
    allowMultipleAnswers?: boolean | undefined;
}>;
declare const RawMessagePayloadSchema: z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
    type: z.ZodLiteral<"text">;
    text: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
    previewUrl: z.ZodOptional<z.ZodBoolean>;
}, "strict", z.ZodTypeAny, {
    type: "text";
    text: string;
    previewUrl?: boolean | undefined;
}, {
    type: "text";
    text: string;
    previewUrl?: boolean | undefined;
}>, z.ZodObject<{
    text: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
    caption: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
    mediaUrl: z.ZodString;
    mimeType: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
    fileName: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
    previewUrl: z.ZodOptional<z.ZodBoolean>;
} & {
    type: z.ZodLiteral<"image">;
}, "strict", z.ZodTypeAny, {
    type: "image";
    mediaUrl: string;
    text?: string | undefined;
    caption?: string | undefined;
    previewUrl?: boolean | undefined;
    mimeType?: string | undefined;
    fileName?: string | undefined;
}, {
    type: "image";
    mediaUrl: string;
    text?: string | undefined;
    caption?: string | undefined;
    previewUrl?: boolean | undefined;
    mimeType?: string | undefined;
    fileName?: string | undefined;
}>, z.ZodObject<{
    text: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
    caption: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
    mediaUrl: z.ZodString;
    mimeType: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
    fileName: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
    previewUrl: z.ZodOptional<z.ZodBoolean>;
} & {
    type: z.ZodLiteral<"document">;
}, "strict", z.ZodTypeAny, {
    type: "document";
    mediaUrl: string;
    text?: string | undefined;
    caption?: string | undefined;
    previewUrl?: boolean | undefined;
    mimeType?: string | undefined;
    fileName?: string | undefined;
}, {
    type: "document";
    mediaUrl: string;
    text?: string | undefined;
    caption?: string | undefined;
    previewUrl?: boolean | undefined;
    mimeType?: string | undefined;
    fileName?: string | undefined;
}>, z.ZodObject<{
    text: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
    caption: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
    mediaUrl: z.ZodString;
    mimeType: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
    fileName: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
    previewUrl: z.ZodOptional<z.ZodBoolean>;
} & {
    type: z.ZodLiteral<"audio">;
}, "strict", z.ZodTypeAny, {
    type: "audio";
    mediaUrl: string;
    text?: string | undefined;
    caption?: string | undefined;
    previewUrl?: boolean | undefined;
    mimeType?: string | undefined;
    fileName?: string | undefined;
}, {
    type: "audio";
    mediaUrl: string;
    text?: string | undefined;
    caption?: string | undefined;
    previewUrl?: boolean | undefined;
    mimeType?: string | undefined;
    fileName?: string | undefined;
}>, z.ZodObject<{
    text: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
    caption: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
    mediaUrl: z.ZodString;
    mimeType: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
    fileName: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
    previewUrl: z.ZodOptional<z.ZodBoolean>;
} & {
    type: z.ZodLiteral<"video">;
}, "strict", z.ZodTypeAny, {
    type: "video";
    mediaUrl: string;
    text?: string | undefined;
    caption?: string | undefined;
    previewUrl?: boolean | undefined;
    mimeType?: string | undefined;
    fileName?: string | undefined;
}, {
    type: "video";
    mediaUrl: string;
    text?: string | undefined;
    caption?: string | undefined;
    previewUrl?: boolean | undefined;
    mimeType?: string | undefined;
    fileName?: string | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"location">;
    text: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
    previewUrl: z.ZodOptional<z.ZodBoolean>;
    location: z.ZodObject<{
        latitude: z.ZodNumber;
        longitude: z.ZodNumber;
        name: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
        address: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
        url: z.ZodOptional<z.ZodString>;
    }, "strict", z.ZodTypeAny, {
        latitude: number;
        longitude: number;
        name?: string | undefined;
        url?: string | undefined;
        address?: string | undefined;
    }, {
        latitude: number;
        longitude: number;
        name?: string | undefined;
        url?: string | undefined;
        address?: string | undefined;
    }>;
}, "strict", z.ZodTypeAny, {
    type: "location";
    location: {
        latitude: number;
        longitude: number;
        name?: string | undefined;
        url?: string | undefined;
        address?: string | undefined;
    };
    text?: string | undefined;
    previewUrl?: boolean | undefined;
}, {
    type: "location";
    location: {
        latitude: number;
        longitude: number;
        name?: string | undefined;
        url?: string | undefined;
        address?: string | undefined;
    };
    text?: string | undefined;
    previewUrl?: boolean | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"contact">;
    text: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
    previewUrl: z.ZodOptional<z.ZodBoolean>;
    contact: z.ZodEffects<z.ZodObject<{
        fullName: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
        organization: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
        emails: z.ZodOptional<z.ZodArray<z.ZodObject<{
            email: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
            type: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
        }, "strict", z.ZodTypeAny, {
            email: string;
            type?: string | undefined;
        }, {
            email: string;
            type?: string | undefined;
        }>, "many">>;
        phones: z.ZodOptional<z.ZodArray<z.ZodObject<{
            phoneNumber: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
            type: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
            waId: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
        }, "strict", z.ZodTypeAny, {
            phoneNumber: string;
            type?: string | undefined;
            waId?: string | undefined;
        }, {
            phoneNumber: string;
            type?: string | undefined;
            waId?: string | undefined;
        }>, "many">>;
        vcard: z.ZodOptional<z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>>;
    }, "strict", z.ZodTypeAny, {
        organization?: string | undefined;
        fullName?: string | undefined;
        emails?: {
            email: string;
            type?: string | undefined;
        }[] | undefined;
        phones?: {
            phoneNumber: string;
            type?: string | undefined;
            waId?: string | undefined;
        }[] | undefined;
        vcard?: string | undefined;
    }, {
        organization?: string | undefined;
        fullName?: string | undefined;
        emails?: {
            email: string;
            type?: string | undefined;
        }[] | undefined;
        phones?: {
            phoneNumber: string;
            type?: string | undefined;
            waId?: string | undefined;
        }[] | undefined;
        vcard?: string | undefined;
    }>, {
        organization?: string | undefined;
        fullName?: string | undefined;
        emails?: {
            email: string;
            type?: string | undefined;
        }[] | undefined;
        phones?: {
            phoneNumber: string;
            type?: string | undefined;
            waId?: string | undefined;
        }[] | undefined;
        vcard?: string | undefined;
    }, {
        organization?: string | undefined;
        fullName?: string | undefined;
        emails?: {
            email: string;
            type?: string | undefined;
        }[] | undefined;
        phones?: {
            phoneNumber: string;
            type?: string | undefined;
            waId?: string | undefined;
        }[] | undefined;
        vcard?: string | undefined;
    }>;
}, "strict", z.ZodTypeAny, {
    type: "contact";
    contact: {
        organization?: string | undefined;
        fullName?: string | undefined;
        emails?: {
            email: string;
            type?: string | undefined;
        }[] | undefined;
        phones?: {
            phoneNumber: string;
            type?: string | undefined;
            waId?: string | undefined;
        }[] | undefined;
        vcard?: string | undefined;
    };
    text?: string | undefined;
    previewUrl?: boolean | undefined;
}, {
    type: "contact";
    contact: {
        organization?: string | undefined;
        fullName?: string | undefined;
        emails?: {
            email: string;
            type?: string | undefined;
        }[] | undefined;
        phones?: {
            phoneNumber: string;
            type?: string | undefined;
            waId?: string | undefined;
        }[] | undefined;
        vcard?: string | undefined;
    };
    text?: string | undefined;
    previewUrl?: boolean | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"template">;
    text: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
    previewUrl: z.ZodOptional<z.ZodBoolean>;
    template: z.ZodObject<{
        namespace: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
        name: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
        language: z.ZodObject<{
            code: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
            policy: z.ZodOptional<z.ZodEnum<["deterministic", "fallback"]>>;
        }, "strict", z.ZodTypeAny, {
            code: string;
            policy?: "fallback" | "deterministic" | undefined;
        }, {
            code: string;
            policy?: "fallback" | "deterministic" | undefined;
        }>;
        components: z.ZodOptional<z.ZodArray<z.ZodEffects<z.ZodObject<{
            type: z.ZodEnum<["header", "body", "footer", "button"]>;
            subType: z.ZodOptional<z.ZodEnum<["quick_reply", "url", "copy_code", "phone_number"]>>;
            index: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
            parameters: z.ZodOptional<z.ZodArray<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
                type: z.ZodLiteral<"text">;
                text: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
            }, "strict", z.ZodTypeAny, {
                type: "text";
                text: string;
            }, {
                type: "text";
                text: string;
            }>, z.ZodObject<{
                type: z.ZodLiteral<"currency">;
                currency: z.ZodObject<{
                    amount1000: z.ZodNumber;
                    currencyCode: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
                }, "strict", z.ZodTypeAny, {
                    amount1000: number;
                    currencyCode: string;
                }, {
                    amount1000: number;
                    currencyCode: string;
                }>;
            }, "strict", z.ZodTypeAny, {
                type: "currency";
                currency: {
                    amount1000: number;
                    currencyCode: string;
                };
            }, {
                type: "currency";
                currency: {
                    amount1000: number;
                    currencyCode: string;
                };
            }>, z.ZodObject<{
                type: z.ZodLiteral<"date_time">;
                dateTime: z.ZodEffects<z.ZodObject<{
                    fallbackValue: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
                    timestamp: z.ZodOptional<z.ZodNumber>;
                }, "strict", z.ZodTypeAny, {
                    timestamp?: number | undefined;
                    fallbackValue?: string | undefined;
                }, {
                    timestamp?: number | undefined;
                    fallbackValue?: string | undefined;
                }>, {
                    timestamp?: number | undefined;
                    fallbackValue?: string | undefined;
                }, {
                    timestamp?: number | undefined;
                    fallbackValue?: string | undefined;
                }>;
            }, "strict", z.ZodTypeAny, {
                type: "date_time";
                dateTime: {
                    timestamp?: number | undefined;
                    fallbackValue?: string | undefined;
                };
            }, {
                type: "date_time";
                dateTime: {
                    timestamp?: number | undefined;
                    fallbackValue?: string | undefined;
                };
            }>, z.ZodObject<{
                type: z.ZodLiteral<"image">;
                image: z.ZodObject<{
                    link: z.ZodString;
                }, "strict", z.ZodTypeAny, {
                    link: string;
                }, {
                    link: string;
                }>;
            }, "strict", z.ZodTypeAny, {
                type: "image";
                image: {
                    link: string;
                };
            }, {
                type: "image";
                image: {
                    link: string;
                };
            }>, z.ZodObject<{
                type: z.ZodLiteral<"document">;
                document: z.ZodObject<{
                    link: z.ZodString;
                    filename: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
                }, "strict", z.ZodTypeAny, {
                    link: string;
                    filename?: string | undefined;
                }, {
                    link: string;
                    filename?: string | undefined;
                }>;
            }, "strict", z.ZodTypeAny, {
                type: "document";
                document: {
                    link: string;
                    filename?: string | undefined;
                };
            }, {
                type: "document";
                document: {
                    link: string;
                    filename?: string | undefined;
                };
            }>, z.ZodObject<{
                type: z.ZodLiteral<"video">;
                video: z.ZodObject<{
                    link: z.ZodString;
                }, "strict", z.ZodTypeAny, {
                    link: string;
                }, {
                    link: string;
                }>;
            }, "strict", z.ZodTypeAny, {
                type: "video";
                video: {
                    link: string;
                };
            }, {
                type: "video";
                video: {
                    link: string;
                };
            }>]>, "many">>;
        }, "strict", z.ZodTypeAny, {
            type: "button" | "body" | "footer" | "header";
            index?: string | undefined;
            subType?: "url" | "phone_number" | "quick_reply" | "copy_code" | undefined;
            parameters?: ({
                type: "text";
                text: string;
            } | {
                type: "currency";
                currency: {
                    amount1000: number;
                    currencyCode: string;
                };
            } | {
                type: "date_time";
                dateTime: {
                    timestamp?: number | undefined;
                    fallbackValue?: string | undefined;
                };
            } | {
                type: "image";
                image: {
                    link: string;
                };
            } | {
                type: "document";
                document: {
                    link: string;
                    filename?: string | undefined;
                };
            } | {
                type: "video";
                video: {
                    link: string;
                };
            })[] | undefined;
        }, {
            type: "button" | "body" | "footer" | "header";
            index?: string | undefined;
            subType?: "url" | "phone_number" | "quick_reply" | "copy_code" | undefined;
            parameters?: ({
                type: "text";
                text: string;
            } | {
                type: "currency";
                currency: {
                    amount1000: number;
                    currencyCode: string;
                };
            } | {
                type: "date_time";
                dateTime: {
                    timestamp?: number | undefined;
                    fallbackValue?: string | undefined;
                };
            } | {
                type: "image";
                image: {
                    link: string;
                };
            } | {
                type: "document";
                document: {
                    link: string;
                    filename?: string | undefined;
                };
            } | {
                type: "video";
                video: {
                    link: string;
                };
            })[] | undefined;
        }>, {
            type: "button" | "body" | "footer" | "header";
            index?: string | undefined;
            subType?: "url" | "phone_number" | "quick_reply" | "copy_code" | undefined;
            parameters?: ({
                type: "text";
                text: string;
            } | {
                type: "currency";
                currency: {
                    amount1000: number;
                    currencyCode: string;
                };
            } | {
                type: "date_time";
                dateTime: {
                    timestamp?: number | undefined;
                    fallbackValue?: string | undefined;
                };
            } | {
                type: "image";
                image: {
                    link: string;
                };
            } | {
                type: "document";
                document: {
                    link: string;
                    filename?: string | undefined;
                };
            } | {
                type: "video";
                video: {
                    link: string;
                };
            })[] | undefined;
        }, {
            type: "button" | "body" | "footer" | "header";
            index?: string | undefined;
            subType?: "url" | "phone_number" | "quick_reply" | "copy_code" | undefined;
            parameters?: ({
                type: "text";
                text: string;
            } | {
                type: "currency";
                currency: {
                    amount1000: number;
                    currencyCode: string;
                };
            } | {
                type: "date_time";
                dateTime: {
                    timestamp?: number | undefined;
                    fallbackValue?: string | undefined;
                };
            } | {
                type: "image";
                image: {
                    link: string;
                };
            } | {
                type: "document";
                document: {
                    link: string;
                    filename?: string | undefined;
                };
            } | {
                type: "video";
                video: {
                    link: string;
                };
            })[] | undefined;
        }>, "many">>;
    }, "strict", z.ZodTypeAny, {
        name: string;
        namespace: string;
        language: {
            code: string;
            policy?: "fallback" | "deterministic" | undefined;
        };
        components?: {
            type: "button" | "body" | "footer" | "header";
            index?: string | undefined;
            subType?: "url" | "phone_number" | "quick_reply" | "copy_code" | undefined;
            parameters?: ({
                type: "text";
                text: string;
            } | {
                type: "currency";
                currency: {
                    amount1000: number;
                    currencyCode: string;
                };
            } | {
                type: "date_time";
                dateTime: {
                    timestamp?: number | undefined;
                    fallbackValue?: string | undefined;
                };
            } | {
                type: "image";
                image: {
                    link: string;
                };
            } | {
                type: "document";
                document: {
                    link: string;
                    filename?: string | undefined;
                };
            } | {
                type: "video";
                video: {
                    link: string;
                };
            })[] | undefined;
        }[] | undefined;
    }, {
        name: string;
        namespace: string;
        language: {
            code: string;
            policy?: "fallback" | "deterministic" | undefined;
        };
        components?: {
            type: "button" | "body" | "footer" | "header";
            index?: string | undefined;
            subType?: "url" | "phone_number" | "quick_reply" | "copy_code" | undefined;
            parameters?: ({
                type: "text";
                text: string;
            } | {
                type: "currency";
                currency: {
                    amount1000: number;
                    currencyCode: string;
                };
            } | {
                type: "date_time";
                dateTime: {
                    timestamp?: number | undefined;
                    fallbackValue?: string | undefined;
                };
            } | {
                type: "image";
                image: {
                    link: string;
                };
            } | {
                type: "document";
                document: {
                    link: string;
                    filename?: string | undefined;
                };
            } | {
                type: "video";
                video: {
                    link: string;
                };
            })[] | undefined;
        }[] | undefined;
    }>;
}, "strict", z.ZodTypeAny, {
    type: "template";
    template: {
        name: string;
        namespace: string;
        language: {
            code: string;
            policy?: "fallback" | "deterministic" | undefined;
        };
        components?: {
            type: "button" | "body" | "footer" | "header";
            index?: string | undefined;
            subType?: "url" | "phone_number" | "quick_reply" | "copy_code" | undefined;
            parameters?: ({
                type: "text";
                text: string;
            } | {
                type: "currency";
                currency: {
                    amount1000: number;
                    currencyCode: string;
                };
            } | {
                type: "date_time";
                dateTime: {
                    timestamp?: number | undefined;
                    fallbackValue?: string | undefined;
                };
            } | {
                type: "image";
                image: {
                    link: string;
                };
            } | {
                type: "document";
                document: {
                    link: string;
                    filename?: string | undefined;
                };
            } | {
                type: "video";
                video: {
                    link: string;
                };
            })[] | undefined;
        }[] | undefined;
    };
    text?: string | undefined;
    previewUrl?: boolean | undefined;
}, {
    type: "template";
    template: {
        name: string;
        namespace: string;
        language: {
            code: string;
            policy?: "fallback" | "deterministic" | undefined;
        };
        components?: {
            type: "button" | "body" | "footer" | "header";
            index?: string | undefined;
            subType?: "url" | "phone_number" | "quick_reply" | "copy_code" | undefined;
            parameters?: ({
                type: "text";
                text: string;
            } | {
                type: "currency";
                currency: {
                    amount1000: number;
                    currencyCode: string;
                };
            } | {
                type: "date_time";
                dateTime: {
                    timestamp?: number | undefined;
                    fallbackValue?: string | undefined;
                };
            } | {
                type: "image";
                image: {
                    link: string;
                };
            } | {
                type: "document";
                document: {
                    link: string;
                    filename?: string | undefined;
                };
            } | {
                type: "video";
                video: {
                    link: string;
                };
            })[] | undefined;
        }[] | undefined;
    };
    text?: string | undefined;
    previewUrl?: boolean | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"poll">;
    poll: z.ZodObject<{
        question: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
        options: z.ZodArray<z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>, "many">;
        allowMultipleAnswers: z.ZodOptional<z.ZodBoolean>;
    }, "strict", z.ZodTypeAny, {
        options: string[];
        question: string;
        allowMultipleAnswers?: boolean | undefined;
    }, {
        options: string[];
        question: string;
        allowMultipleAnswers?: boolean | undefined;
    }>;
}, "strict", z.ZodTypeAny, {
    type: "poll";
    poll: {
        options: string[];
        question: string;
        allowMultipleAnswers?: boolean | undefined;
    };
}, {
    type: "poll";
    poll: {
        options: string[];
        question: string;
        allowMultipleAnswers?: boolean | undefined;
    };
}>]>;
export declare const MessagePayloadSchema: z.ZodEffects<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
    type: z.ZodLiteral<"text">;
    text: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
    previewUrl: z.ZodOptional<z.ZodBoolean>;
}, "strict", z.ZodTypeAny, {
    type: "text";
    text: string;
    previewUrl?: boolean | undefined;
}, {
    type: "text";
    text: string;
    previewUrl?: boolean | undefined;
}>, z.ZodObject<{
    text: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
    caption: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
    mediaUrl: z.ZodString;
    mimeType: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
    fileName: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
    previewUrl: z.ZodOptional<z.ZodBoolean>;
} & {
    type: z.ZodLiteral<"image">;
}, "strict", z.ZodTypeAny, {
    type: "image";
    mediaUrl: string;
    text?: string | undefined;
    caption?: string | undefined;
    previewUrl?: boolean | undefined;
    mimeType?: string | undefined;
    fileName?: string | undefined;
}, {
    type: "image";
    mediaUrl: string;
    text?: string | undefined;
    caption?: string | undefined;
    previewUrl?: boolean | undefined;
    mimeType?: string | undefined;
    fileName?: string | undefined;
}>, z.ZodObject<{
    text: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
    caption: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
    mediaUrl: z.ZodString;
    mimeType: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
    fileName: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
    previewUrl: z.ZodOptional<z.ZodBoolean>;
} & {
    type: z.ZodLiteral<"document">;
}, "strict", z.ZodTypeAny, {
    type: "document";
    mediaUrl: string;
    text?: string | undefined;
    caption?: string | undefined;
    previewUrl?: boolean | undefined;
    mimeType?: string | undefined;
    fileName?: string | undefined;
}, {
    type: "document";
    mediaUrl: string;
    text?: string | undefined;
    caption?: string | undefined;
    previewUrl?: boolean | undefined;
    mimeType?: string | undefined;
    fileName?: string | undefined;
}>, z.ZodObject<{
    text: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
    caption: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
    mediaUrl: z.ZodString;
    mimeType: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
    fileName: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
    previewUrl: z.ZodOptional<z.ZodBoolean>;
} & {
    type: z.ZodLiteral<"audio">;
}, "strict", z.ZodTypeAny, {
    type: "audio";
    mediaUrl: string;
    text?: string | undefined;
    caption?: string | undefined;
    previewUrl?: boolean | undefined;
    mimeType?: string | undefined;
    fileName?: string | undefined;
}, {
    type: "audio";
    mediaUrl: string;
    text?: string | undefined;
    caption?: string | undefined;
    previewUrl?: boolean | undefined;
    mimeType?: string | undefined;
    fileName?: string | undefined;
}>, z.ZodObject<{
    text: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
    caption: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
    mediaUrl: z.ZodString;
    mimeType: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
    fileName: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
    previewUrl: z.ZodOptional<z.ZodBoolean>;
} & {
    type: z.ZodLiteral<"video">;
}, "strict", z.ZodTypeAny, {
    type: "video";
    mediaUrl: string;
    text?: string | undefined;
    caption?: string | undefined;
    previewUrl?: boolean | undefined;
    mimeType?: string | undefined;
    fileName?: string | undefined;
}, {
    type: "video";
    mediaUrl: string;
    text?: string | undefined;
    caption?: string | undefined;
    previewUrl?: boolean | undefined;
    mimeType?: string | undefined;
    fileName?: string | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"location">;
    text: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
    previewUrl: z.ZodOptional<z.ZodBoolean>;
    location: z.ZodObject<{
        latitude: z.ZodNumber;
        longitude: z.ZodNumber;
        name: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
        address: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
        url: z.ZodOptional<z.ZodString>;
    }, "strict", z.ZodTypeAny, {
        latitude: number;
        longitude: number;
        name?: string | undefined;
        url?: string | undefined;
        address?: string | undefined;
    }, {
        latitude: number;
        longitude: number;
        name?: string | undefined;
        url?: string | undefined;
        address?: string | undefined;
    }>;
}, "strict", z.ZodTypeAny, {
    type: "location";
    location: {
        latitude: number;
        longitude: number;
        name?: string | undefined;
        url?: string | undefined;
        address?: string | undefined;
    };
    text?: string | undefined;
    previewUrl?: boolean | undefined;
}, {
    type: "location";
    location: {
        latitude: number;
        longitude: number;
        name?: string | undefined;
        url?: string | undefined;
        address?: string | undefined;
    };
    text?: string | undefined;
    previewUrl?: boolean | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"contact">;
    text: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
    previewUrl: z.ZodOptional<z.ZodBoolean>;
    contact: z.ZodEffects<z.ZodObject<{
        fullName: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
        organization: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
        emails: z.ZodOptional<z.ZodArray<z.ZodObject<{
            email: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
            type: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
        }, "strict", z.ZodTypeAny, {
            email: string;
            type?: string | undefined;
        }, {
            email: string;
            type?: string | undefined;
        }>, "many">>;
        phones: z.ZodOptional<z.ZodArray<z.ZodObject<{
            phoneNumber: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
            type: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
            waId: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
        }, "strict", z.ZodTypeAny, {
            phoneNumber: string;
            type?: string | undefined;
            waId?: string | undefined;
        }, {
            phoneNumber: string;
            type?: string | undefined;
            waId?: string | undefined;
        }>, "many">>;
        vcard: z.ZodOptional<z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>>;
    }, "strict", z.ZodTypeAny, {
        organization?: string | undefined;
        fullName?: string | undefined;
        emails?: {
            email: string;
            type?: string | undefined;
        }[] | undefined;
        phones?: {
            phoneNumber: string;
            type?: string | undefined;
            waId?: string | undefined;
        }[] | undefined;
        vcard?: string | undefined;
    }, {
        organization?: string | undefined;
        fullName?: string | undefined;
        emails?: {
            email: string;
            type?: string | undefined;
        }[] | undefined;
        phones?: {
            phoneNumber: string;
            type?: string | undefined;
            waId?: string | undefined;
        }[] | undefined;
        vcard?: string | undefined;
    }>, {
        organization?: string | undefined;
        fullName?: string | undefined;
        emails?: {
            email: string;
            type?: string | undefined;
        }[] | undefined;
        phones?: {
            phoneNumber: string;
            type?: string | undefined;
            waId?: string | undefined;
        }[] | undefined;
        vcard?: string | undefined;
    }, {
        organization?: string | undefined;
        fullName?: string | undefined;
        emails?: {
            email: string;
            type?: string | undefined;
        }[] | undefined;
        phones?: {
            phoneNumber: string;
            type?: string | undefined;
            waId?: string | undefined;
        }[] | undefined;
        vcard?: string | undefined;
    }>;
}, "strict", z.ZodTypeAny, {
    type: "contact";
    contact: {
        organization?: string | undefined;
        fullName?: string | undefined;
        emails?: {
            email: string;
            type?: string | undefined;
        }[] | undefined;
        phones?: {
            phoneNumber: string;
            type?: string | undefined;
            waId?: string | undefined;
        }[] | undefined;
        vcard?: string | undefined;
    };
    text?: string | undefined;
    previewUrl?: boolean | undefined;
}, {
    type: "contact";
    contact: {
        organization?: string | undefined;
        fullName?: string | undefined;
        emails?: {
            email: string;
            type?: string | undefined;
        }[] | undefined;
        phones?: {
            phoneNumber: string;
            type?: string | undefined;
            waId?: string | undefined;
        }[] | undefined;
        vcard?: string | undefined;
    };
    text?: string | undefined;
    previewUrl?: boolean | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"template">;
    text: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
    previewUrl: z.ZodOptional<z.ZodBoolean>;
    template: z.ZodObject<{
        namespace: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
        name: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
        language: z.ZodObject<{
            code: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
            policy: z.ZodOptional<z.ZodEnum<["deterministic", "fallback"]>>;
        }, "strict", z.ZodTypeAny, {
            code: string;
            policy?: "fallback" | "deterministic" | undefined;
        }, {
            code: string;
            policy?: "fallback" | "deterministic" | undefined;
        }>;
        components: z.ZodOptional<z.ZodArray<z.ZodEffects<z.ZodObject<{
            type: z.ZodEnum<["header", "body", "footer", "button"]>;
            subType: z.ZodOptional<z.ZodEnum<["quick_reply", "url", "copy_code", "phone_number"]>>;
            index: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
            parameters: z.ZodOptional<z.ZodArray<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
                type: z.ZodLiteral<"text">;
                text: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
            }, "strict", z.ZodTypeAny, {
                type: "text";
                text: string;
            }, {
                type: "text";
                text: string;
            }>, z.ZodObject<{
                type: z.ZodLiteral<"currency">;
                currency: z.ZodObject<{
                    amount1000: z.ZodNumber;
                    currencyCode: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
                }, "strict", z.ZodTypeAny, {
                    amount1000: number;
                    currencyCode: string;
                }, {
                    amount1000: number;
                    currencyCode: string;
                }>;
            }, "strict", z.ZodTypeAny, {
                type: "currency";
                currency: {
                    amount1000: number;
                    currencyCode: string;
                };
            }, {
                type: "currency";
                currency: {
                    amount1000: number;
                    currencyCode: string;
                };
            }>, z.ZodObject<{
                type: z.ZodLiteral<"date_time">;
                dateTime: z.ZodEffects<z.ZodObject<{
                    fallbackValue: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
                    timestamp: z.ZodOptional<z.ZodNumber>;
                }, "strict", z.ZodTypeAny, {
                    timestamp?: number | undefined;
                    fallbackValue?: string | undefined;
                }, {
                    timestamp?: number | undefined;
                    fallbackValue?: string | undefined;
                }>, {
                    timestamp?: number | undefined;
                    fallbackValue?: string | undefined;
                }, {
                    timestamp?: number | undefined;
                    fallbackValue?: string | undefined;
                }>;
            }, "strict", z.ZodTypeAny, {
                type: "date_time";
                dateTime: {
                    timestamp?: number | undefined;
                    fallbackValue?: string | undefined;
                };
            }, {
                type: "date_time";
                dateTime: {
                    timestamp?: number | undefined;
                    fallbackValue?: string | undefined;
                };
            }>, z.ZodObject<{
                type: z.ZodLiteral<"image">;
                image: z.ZodObject<{
                    link: z.ZodString;
                }, "strict", z.ZodTypeAny, {
                    link: string;
                }, {
                    link: string;
                }>;
            }, "strict", z.ZodTypeAny, {
                type: "image";
                image: {
                    link: string;
                };
            }, {
                type: "image";
                image: {
                    link: string;
                };
            }>, z.ZodObject<{
                type: z.ZodLiteral<"document">;
                document: z.ZodObject<{
                    link: z.ZodString;
                    filename: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
                }, "strict", z.ZodTypeAny, {
                    link: string;
                    filename?: string | undefined;
                }, {
                    link: string;
                    filename?: string | undefined;
                }>;
            }, "strict", z.ZodTypeAny, {
                type: "document";
                document: {
                    link: string;
                    filename?: string | undefined;
                };
            }, {
                type: "document";
                document: {
                    link: string;
                    filename?: string | undefined;
                };
            }>, z.ZodObject<{
                type: z.ZodLiteral<"video">;
                video: z.ZodObject<{
                    link: z.ZodString;
                }, "strict", z.ZodTypeAny, {
                    link: string;
                }, {
                    link: string;
                }>;
            }, "strict", z.ZodTypeAny, {
                type: "video";
                video: {
                    link: string;
                };
            }, {
                type: "video";
                video: {
                    link: string;
                };
            }>]>, "many">>;
        }, "strict", z.ZodTypeAny, {
            type: "button" | "body" | "footer" | "header";
            index?: string | undefined;
            subType?: "url" | "phone_number" | "quick_reply" | "copy_code" | undefined;
            parameters?: ({
                type: "text";
                text: string;
            } | {
                type: "currency";
                currency: {
                    amount1000: number;
                    currencyCode: string;
                };
            } | {
                type: "date_time";
                dateTime: {
                    timestamp?: number | undefined;
                    fallbackValue?: string | undefined;
                };
            } | {
                type: "image";
                image: {
                    link: string;
                };
            } | {
                type: "document";
                document: {
                    link: string;
                    filename?: string | undefined;
                };
            } | {
                type: "video";
                video: {
                    link: string;
                };
            })[] | undefined;
        }, {
            type: "button" | "body" | "footer" | "header";
            index?: string | undefined;
            subType?: "url" | "phone_number" | "quick_reply" | "copy_code" | undefined;
            parameters?: ({
                type: "text";
                text: string;
            } | {
                type: "currency";
                currency: {
                    amount1000: number;
                    currencyCode: string;
                };
            } | {
                type: "date_time";
                dateTime: {
                    timestamp?: number | undefined;
                    fallbackValue?: string | undefined;
                };
            } | {
                type: "image";
                image: {
                    link: string;
                };
            } | {
                type: "document";
                document: {
                    link: string;
                    filename?: string | undefined;
                };
            } | {
                type: "video";
                video: {
                    link: string;
                };
            })[] | undefined;
        }>, {
            type: "button" | "body" | "footer" | "header";
            index?: string | undefined;
            subType?: "url" | "phone_number" | "quick_reply" | "copy_code" | undefined;
            parameters?: ({
                type: "text";
                text: string;
            } | {
                type: "currency";
                currency: {
                    amount1000: number;
                    currencyCode: string;
                };
            } | {
                type: "date_time";
                dateTime: {
                    timestamp?: number | undefined;
                    fallbackValue?: string | undefined;
                };
            } | {
                type: "image";
                image: {
                    link: string;
                };
            } | {
                type: "document";
                document: {
                    link: string;
                    filename?: string | undefined;
                };
            } | {
                type: "video";
                video: {
                    link: string;
                };
            })[] | undefined;
        }, {
            type: "button" | "body" | "footer" | "header";
            index?: string | undefined;
            subType?: "url" | "phone_number" | "quick_reply" | "copy_code" | undefined;
            parameters?: ({
                type: "text";
                text: string;
            } | {
                type: "currency";
                currency: {
                    amount1000: number;
                    currencyCode: string;
                };
            } | {
                type: "date_time";
                dateTime: {
                    timestamp?: number | undefined;
                    fallbackValue?: string | undefined;
                };
            } | {
                type: "image";
                image: {
                    link: string;
                };
            } | {
                type: "document";
                document: {
                    link: string;
                    filename?: string | undefined;
                };
            } | {
                type: "video";
                video: {
                    link: string;
                };
            })[] | undefined;
        }>, "many">>;
    }, "strict", z.ZodTypeAny, {
        name: string;
        namespace: string;
        language: {
            code: string;
            policy?: "fallback" | "deterministic" | undefined;
        };
        components?: {
            type: "button" | "body" | "footer" | "header";
            index?: string | undefined;
            subType?: "url" | "phone_number" | "quick_reply" | "copy_code" | undefined;
            parameters?: ({
                type: "text";
                text: string;
            } | {
                type: "currency";
                currency: {
                    amount1000: number;
                    currencyCode: string;
                };
            } | {
                type: "date_time";
                dateTime: {
                    timestamp?: number | undefined;
                    fallbackValue?: string | undefined;
                };
            } | {
                type: "image";
                image: {
                    link: string;
                };
            } | {
                type: "document";
                document: {
                    link: string;
                    filename?: string | undefined;
                };
            } | {
                type: "video";
                video: {
                    link: string;
                };
            })[] | undefined;
        }[] | undefined;
    }, {
        name: string;
        namespace: string;
        language: {
            code: string;
            policy?: "fallback" | "deterministic" | undefined;
        };
        components?: {
            type: "button" | "body" | "footer" | "header";
            index?: string | undefined;
            subType?: "url" | "phone_number" | "quick_reply" | "copy_code" | undefined;
            parameters?: ({
                type: "text";
                text: string;
            } | {
                type: "currency";
                currency: {
                    amount1000: number;
                    currencyCode: string;
                };
            } | {
                type: "date_time";
                dateTime: {
                    timestamp?: number | undefined;
                    fallbackValue?: string | undefined;
                };
            } | {
                type: "image";
                image: {
                    link: string;
                };
            } | {
                type: "document";
                document: {
                    link: string;
                    filename?: string | undefined;
                };
            } | {
                type: "video";
                video: {
                    link: string;
                };
            })[] | undefined;
        }[] | undefined;
    }>;
}, "strict", z.ZodTypeAny, {
    type: "template";
    template: {
        name: string;
        namespace: string;
        language: {
            code: string;
            policy?: "fallback" | "deterministic" | undefined;
        };
        components?: {
            type: "button" | "body" | "footer" | "header";
            index?: string | undefined;
            subType?: "url" | "phone_number" | "quick_reply" | "copy_code" | undefined;
            parameters?: ({
                type: "text";
                text: string;
            } | {
                type: "currency";
                currency: {
                    amount1000: number;
                    currencyCode: string;
                };
            } | {
                type: "date_time";
                dateTime: {
                    timestamp?: number | undefined;
                    fallbackValue?: string | undefined;
                };
            } | {
                type: "image";
                image: {
                    link: string;
                };
            } | {
                type: "document";
                document: {
                    link: string;
                    filename?: string | undefined;
                };
            } | {
                type: "video";
                video: {
                    link: string;
                };
            })[] | undefined;
        }[] | undefined;
    };
    text?: string | undefined;
    previewUrl?: boolean | undefined;
}, {
    type: "template";
    template: {
        name: string;
        namespace: string;
        language: {
            code: string;
            policy?: "fallback" | "deterministic" | undefined;
        };
        components?: {
            type: "button" | "body" | "footer" | "header";
            index?: string | undefined;
            subType?: "url" | "phone_number" | "quick_reply" | "copy_code" | undefined;
            parameters?: ({
                type: "text";
                text: string;
            } | {
                type: "currency";
                currency: {
                    amount1000: number;
                    currencyCode: string;
                };
            } | {
                type: "date_time";
                dateTime: {
                    timestamp?: number | undefined;
                    fallbackValue?: string | undefined;
                };
            } | {
                type: "image";
                image: {
                    link: string;
                };
            } | {
                type: "document";
                document: {
                    link: string;
                    filename?: string | undefined;
                };
            } | {
                type: "video";
                video: {
                    link: string;
                };
            })[] | undefined;
        }[] | undefined;
    };
    text?: string | undefined;
    previewUrl?: boolean | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"poll">;
    poll: z.ZodObject<{
        question: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
        options: z.ZodArray<z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>, "many">;
        allowMultipleAnswers: z.ZodOptional<z.ZodBoolean>;
    }, "strict", z.ZodTypeAny, {
        options: string[];
        question: string;
        allowMultipleAnswers?: boolean | undefined;
    }, {
        options: string[];
        question: string;
        allowMultipleAnswers?: boolean | undefined;
    }>;
}, "strict", z.ZodTypeAny, {
    type: "poll";
    poll: {
        options: string[];
        question: string;
        allowMultipleAnswers?: boolean | undefined;
    };
}, {
    type: "poll";
    poll: {
        options: string[];
        question: string;
        allowMultipleAnswers?: boolean | undefined;
    };
}>]>, {
    type: "image";
    mediaUrl: string;
    text?: string | undefined;
    caption?: string | undefined;
    previewUrl?: boolean | undefined;
    mimeType?: string | undefined;
    fileName?: string | undefined;
} | {
    type: "document";
    mediaUrl: string;
    text?: string | undefined;
    caption?: string | undefined;
    previewUrl?: boolean | undefined;
    mimeType?: string | undefined;
    fileName?: string | undefined;
} | {
    type: "audio";
    mediaUrl: string;
    text?: string | undefined;
    caption?: string | undefined;
    previewUrl?: boolean | undefined;
    mimeType?: string | undefined;
    fileName?: string | undefined;
} | {
    type: "video";
    mediaUrl: string;
    text?: string | undefined;
    caption?: string | undefined;
    previewUrl?: boolean | undefined;
    mimeType?: string | undefined;
    fileName?: string | undefined;
} | {
    type: "text";
    text: string;
    previewUrl?: boolean | undefined;
} | {
    type: "location";
    location: {
        latitude: number;
        longitude: number;
        name?: string | undefined;
        url?: string | undefined;
        address?: string | undefined;
    };
    text?: string | undefined;
    previewUrl?: boolean | undefined;
} | {
    type: "contact";
    contact: {
        organization?: string | undefined;
        fullName?: string | undefined;
        emails?: {
            email: string;
            type?: string | undefined;
        }[] | undefined;
        phones?: {
            phoneNumber: string;
            type?: string | undefined;
            waId?: string | undefined;
        }[] | undefined;
        vcard?: string | undefined;
    };
    text?: string | undefined;
    previewUrl?: boolean | undefined;
} | {
    type: "template";
    template: {
        name: string;
        namespace: string;
        language: {
            code: string;
            policy?: "fallback" | "deterministic" | undefined;
        };
        components?: {
            type: "button" | "body" | "footer" | "header";
            index?: string | undefined;
            subType?: "url" | "phone_number" | "quick_reply" | "copy_code" | undefined;
            parameters?: ({
                type: "text";
                text: string;
            } | {
                type: "currency";
                currency: {
                    amount1000: number;
                    currencyCode: string;
                };
            } | {
                type: "date_time";
                dateTime: {
                    timestamp?: number | undefined;
                    fallbackValue?: string | undefined;
                };
            } | {
                type: "image";
                image: {
                    link: string;
                };
            } | {
                type: "document";
                document: {
                    link: string;
                    filename?: string | undefined;
                };
            } | {
                type: "video";
                video: {
                    link: string;
                };
            })[] | undefined;
        }[] | undefined;
    };
    text?: string | undefined;
    previewUrl?: boolean | undefined;
} | {
    type: "poll";
    poll: {
        options: string[];
        question: string;
        allowMultipleAnswers?: boolean | undefined;
    };
}, unknown>;
export type MessagePayloadInput = z.infer<typeof RawMessagePayloadSchema>;
type LocationPayload = z.infer<typeof LocationDescriptorSchema>;
type ContactPayload = z.infer<typeof ContactDescriptorSchema>;
type TemplatePayload = z.infer<typeof TemplateDescriptorSchema>;
type PollPayload = z.infer<typeof PollDefinitionSchema>;
export declare const SendByTicketSchema: z.ZodObject<{
    instanceId: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
    payload: z.ZodEffects<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
        type: z.ZodLiteral<"text">;
        text: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
        previewUrl: z.ZodOptional<z.ZodBoolean>;
    }, "strict", z.ZodTypeAny, {
        type: "text";
        text: string;
        previewUrl?: boolean | undefined;
    }, {
        type: "text";
        text: string;
        previewUrl?: boolean | undefined;
    }>, z.ZodObject<{
        text: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
        caption: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
        mediaUrl: z.ZodString;
        mimeType: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
        fileName: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
        previewUrl: z.ZodOptional<z.ZodBoolean>;
    } & {
        type: z.ZodLiteral<"image">;
    }, "strict", z.ZodTypeAny, {
        type: "image";
        mediaUrl: string;
        text?: string | undefined;
        caption?: string | undefined;
        previewUrl?: boolean | undefined;
        mimeType?: string | undefined;
        fileName?: string | undefined;
    }, {
        type: "image";
        mediaUrl: string;
        text?: string | undefined;
        caption?: string | undefined;
        previewUrl?: boolean | undefined;
        mimeType?: string | undefined;
        fileName?: string | undefined;
    }>, z.ZodObject<{
        text: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
        caption: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
        mediaUrl: z.ZodString;
        mimeType: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
        fileName: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
        previewUrl: z.ZodOptional<z.ZodBoolean>;
    } & {
        type: z.ZodLiteral<"document">;
    }, "strict", z.ZodTypeAny, {
        type: "document";
        mediaUrl: string;
        text?: string | undefined;
        caption?: string | undefined;
        previewUrl?: boolean | undefined;
        mimeType?: string | undefined;
        fileName?: string | undefined;
    }, {
        type: "document";
        mediaUrl: string;
        text?: string | undefined;
        caption?: string | undefined;
        previewUrl?: boolean | undefined;
        mimeType?: string | undefined;
        fileName?: string | undefined;
    }>, z.ZodObject<{
        text: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
        caption: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
        mediaUrl: z.ZodString;
        mimeType: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
        fileName: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
        previewUrl: z.ZodOptional<z.ZodBoolean>;
    } & {
        type: z.ZodLiteral<"audio">;
    }, "strict", z.ZodTypeAny, {
        type: "audio";
        mediaUrl: string;
        text?: string | undefined;
        caption?: string | undefined;
        previewUrl?: boolean | undefined;
        mimeType?: string | undefined;
        fileName?: string | undefined;
    }, {
        type: "audio";
        mediaUrl: string;
        text?: string | undefined;
        caption?: string | undefined;
        previewUrl?: boolean | undefined;
        mimeType?: string | undefined;
        fileName?: string | undefined;
    }>, z.ZodObject<{
        text: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
        caption: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
        mediaUrl: z.ZodString;
        mimeType: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
        fileName: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
        previewUrl: z.ZodOptional<z.ZodBoolean>;
    } & {
        type: z.ZodLiteral<"video">;
    }, "strict", z.ZodTypeAny, {
        type: "video";
        mediaUrl: string;
        text?: string | undefined;
        caption?: string | undefined;
        previewUrl?: boolean | undefined;
        mimeType?: string | undefined;
        fileName?: string | undefined;
    }, {
        type: "video";
        mediaUrl: string;
        text?: string | undefined;
        caption?: string | undefined;
        previewUrl?: boolean | undefined;
        mimeType?: string | undefined;
        fileName?: string | undefined;
    }>, z.ZodObject<{
        type: z.ZodLiteral<"location">;
        text: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
        previewUrl: z.ZodOptional<z.ZodBoolean>;
        location: z.ZodObject<{
            latitude: z.ZodNumber;
            longitude: z.ZodNumber;
            name: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
            address: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
            url: z.ZodOptional<z.ZodString>;
        }, "strict", z.ZodTypeAny, {
            latitude: number;
            longitude: number;
            name?: string | undefined;
            url?: string | undefined;
            address?: string | undefined;
        }, {
            latitude: number;
            longitude: number;
            name?: string | undefined;
            url?: string | undefined;
            address?: string | undefined;
        }>;
    }, "strict", z.ZodTypeAny, {
        type: "location";
        location: {
            latitude: number;
            longitude: number;
            name?: string | undefined;
            url?: string | undefined;
            address?: string | undefined;
        };
        text?: string | undefined;
        previewUrl?: boolean | undefined;
    }, {
        type: "location";
        location: {
            latitude: number;
            longitude: number;
            name?: string | undefined;
            url?: string | undefined;
            address?: string | undefined;
        };
        text?: string | undefined;
        previewUrl?: boolean | undefined;
    }>, z.ZodObject<{
        type: z.ZodLiteral<"contact">;
        text: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
        previewUrl: z.ZodOptional<z.ZodBoolean>;
        contact: z.ZodEffects<z.ZodObject<{
            fullName: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
            organization: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
            emails: z.ZodOptional<z.ZodArray<z.ZodObject<{
                email: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
                type: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
            }, "strict", z.ZodTypeAny, {
                email: string;
                type?: string | undefined;
            }, {
                email: string;
                type?: string | undefined;
            }>, "many">>;
            phones: z.ZodOptional<z.ZodArray<z.ZodObject<{
                phoneNumber: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
                type: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
                waId: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
            }, "strict", z.ZodTypeAny, {
                phoneNumber: string;
                type?: string | undefined;
                waId?: string | undefined;
            }, {
                phoneNumber: string;
                type?: string | undefined;
                waId?: string | undefined;
            }>, "many">>;
            vcard: z.ZodOptional<z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>>;
        }, "strict", z.ZodTypeAny, {
            organization?: string | undefined;
            fullName?: string | undefined;
            emails?: {
                email: string;
                type?: string | undefined;
            }[] | undefined;
            phones?: {
                phoneNumber: string;
                type?: string | undefined;
                waId?: string | undefined;
            }[] | undefined;
            vcard?: string | undefined;
        }, {
            organization?: string | undefined;
            fullName?: string | undefined;
            emails?: {
                email: string;
                type?: string | undefined;
            }[] | undefined;
            phones?: {
                phoneNumber: string;
                type?: string | undefined;
                waId?: string | undefined;
            }[] | undefined;
            vcard?: string | undefined;
        }>, {
            organization?: string | undefined;
            fullName?: string | undefined;
            emails?: {
                email: string;
                type?: string | undefined;
            }[] | undefined;
            phones?: {
                phoneNumber: string;
                type?: string | undefined;
                waId?: string | undefined;
            }[] | undefined;
            vcard?: string | undefined;
        }, {
            organization?: string | undefined;
            fullName?: string | undefined;
            emails?: {
                email: string;
                type?: string | undefined;
            }[] | undefined;
            phones?: {
                phoneNumber: string;
                type?: string | undefined;
                waId?: string | undefined;
            }[] | undefined;
            vcard?: string | undefined;
        }>;
    }, "strict", z.ZodTypeAny, {
        type: "contact";
        contact: {
            organization?: string | undefined;
            fullName?: string | undefined;
            emails?: {
                email: string;
                type?: string | undefined;
            }[] | undefined;
            phones?: {
                phoneNumber: string;
                type?: string | undefined;
                waId?: string | undefined;
            }[] | undefined;
            vcard?: string | undefined;
        };
        text?: string | undefined;
        previewUrl?: boolean | undefined;
    }, {
        type: "contact";
        contact: {
            organization?: string | undefined;
            fullName?: string | undefined;
            emails?: {
                email: string;
                type?: string | undefined;
            }[] | undefined;
            phones?: {
                phoneNumber: string;
                type?: string | undefined;
                waId?: string | undefined;
            }[] | undefined;
            vcard?: string | undefined;
        };
        text?: string | undefined;
        previewUrl?: boolean | undefined;
    }>, z.ZodObject<{
        type: z.ZodLiteral<"template">;
        text: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
        previewUrl: z.ZodOptional<z.ZodBoolean>;
        template: z.ZodObject<{
            namespace: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
            name: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
            language: z.ZodObject<{
                code: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
                policy: z.ZodOptional<z.ZodEnum<["deterministic", "fallback"]>>;
            }, "strict", z.ZodTypeAny, {
                code: string;
                policy?: "fallback" | "deterministic" | undefined;
            }, {
                code: string;
                policy?: "fallback" | "deterministic" | undefined;
            }>;
            components: z.ZodOptional<z.ZodArray<z.ZodEffects<z.ZodObject<{
                type: z.ZodEnum<["header", "body", "footer", "button"]>;
                subType: z.ZodOptional<z.ZodEnum<["quick_reply", "url", "copy_code", "phone_number"]>>;
                index: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
                parameters: z.ZodOptional<z.ZodArray<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
                    type: z.ZodLiteral<"text">;
                    text: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
                }, "strict", z.ZodTypeAny, {
                    type: "text";
                    text: string;
                }, {
                    type: "text";
                    text: string;
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"currency">;
                    currency: z.ZodObject<{
                        amount1000: z.ZodNumber;
                        currencyCode: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
                    }, "strict", z.ZodTypeAny, {
                        amount1000: number;
                        currencyCode: string;
                    }, {
                        amount1000: number;
                        currencyCode: string;
                    }>;
                }, "strict", z.ZodTypeAny, {
                    type: "currency";
                    currency: {
                        amount1000: number;
                        currencyCode: string;
                    };
                }, {
                    type: "currency";
                    currency: {
                        amount1000: number;
                        currencyCode: string;
                    };
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"date_time">;
                    dateTime: z.ZodEffects<z.ZodObject<{
                        fallbackValue: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
                        timestamp: z.ZodOptional<z.ZodNumber>;
                    }, "strict", z.ZodTypeAny, {
                        timestamp?: number | undefined;
                        fallbackValue?: string | undefined;
                    }, {
                        timestamp?: number | undefined;
                        fallbackValue?: string | undefined;
                    }>, {
                        timestamp?: number | undefined;
                        fallbackValue?: string | undefined;
                    }, {
                        timestamp?: number | undefined;
                        fallbackValue?: string | undefined;
                    }>;
                }, "strict", z.ZodTypeAny, {
                    type: "date_time";
                    dateTime: {
                        timestamp?: number | undefined;
                        fallbackValue?: string | undefined;
                    };
                }, {
                    type: "date_time";
                    dateTime: {
                        timestamp?: number | undefined;
                        fallbackValue?: string | undefined;
                    };
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"image">;
                    image: z.ZodObject<{
                        link: z.ZodString;
                    }, "strict", z.ZodTypeAny, {
                        link: string;
                    }, {
                        link: string;
                    }>;
                }, "strict", z.ZodTypeAny, {
                    type: "image";
                    image: {
                        link: string;
                    };
                }, {
                    type: "image";
                    image: {
                        link: string;
                    };
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"document">;
                    document: z.ZodObject<{
                        link: z.ZodString;
                        filename: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
                    }, "strict", z.ZodTypeAny, {
                        link: string;
                        filename?: string | undefined;
                    }, {
                        link: string;
                        filename?: string | undefined;
                    }>;
                }, "strict", z.ZodTypeAny, {
                    type: "document";
                    document: {
                        link: string;
                        filename?: string | undefined;
                    };
                }, {
                    type: "document";
                    document: {
                        link: string;
                        filename?: string | undefined;
                    };
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"video">;
                    video: z.ZodObject<{
                        link: z.ZodString;
                    }, "strict", z.ZodTypeAny, {
                        link: string;
                    }, {
                        link: string;
                    }>;
                }, "strict", z.ZodTypeAny, {
                    type: "video";
                    video: {
                        link: string;
                    };
                }, {
                    type: "video";
                    video: {
                        link: string;
                    };
                }>]>, "many">>;
            }, "strict", z.ZodTypeAny, {
                type: "button" | "body" | "footer" | "header";
                index?: string | undefined;
                subType?: "url" | "phone_number" | "quick_reply" | "copy_code" | undefined;
                parameters?: ({
                    type: "text";
                    text: string;
                } | {
                    type: "currency";
                    currency: {
                        amount1000: number;
                        currencyCode: string;
                    };
                } | {
                    type: "date_time";
                    dateTime: {
                        timestamp?: number | undefined;
                        fallbackValue?: string | undefined;
                    };
                } | {
                    type: "image";
                    image: {
                        link: string;
                    };
                } | {
                    type: "document";
                    document: {
                        link: string;
                        filename?: string | undefined;
                    };
                } | {
                    type: "video";
                    video: {
                        link: string;
                    };
                })[] | undefined;
            }, {
                type: "button" | "body" | "footer" | "header";
                index?: string | undefined;
                subType?: "url" | "phone_number" | "quick_reply" | "copy_code" | undefined;
                parameters?: ({
                    type: "text";
                    text: string;
                } | {
                    type: "currency";
                    currency: {
                        amount1000: number;
                        currencyCode: string;
                    };
                } | {
                    type: "date_time";
                    dateTime: {
                        timestamp?: number | undefined;
                        fallbackValue?: string | undefined;
                    };
                } | {
                    type: "image";
                    image: {
                        link: string;
                    };
                } | {
                    type: "document";
                    document: {
                        link: string;
                        filename?: string | undefined;
                    };
                } | {
                    type: "video";
                    video: {
                        link: string;
                    };
                })[] | undefined;
            }>, {
                type: "button" | "body" | "footer" | "header";
                index?: string | undefined;
                subType?: "url" | "phone_number" | "quick_reply" | "copy_code" | undefined;
                parameters?: ({
                    type: "text";
                    text: string;
                } | {
                    type: "currency";
                    currency: {
                        amount1000: number;
                        currencyCode: string;
                    };
                } | {
                    type: "date_time";
                    dateTime: {
                        timestamp?: number | undefined;
                        fallbackValue?: string | undefined;
                    };
                } | {
                    type: "image";
                    image: {
                        link: string;
                    };
                } | {
                    type: "document";
                    document: {
                        link: string;
                        filename?: string | undefined;
                    };
                } | {
                    type: "video";
                    video: {
                        link: string;
                    };
                })[] | undefined;
            }, {
                type: "button" | "body" | "footer" | "header";
                index?: string | undefined;
                subType?: "url" | "phone_number" | "quick_reply" | "copy_code" | undefined;
                parameters?: ({
                    type: "text";
                    text: string;
                } | {
                    type: "currency";
                    currency: {
                        amount1000: number;
                        currencyCode: string;
                    };
                } | {
                    type: "date_time";
                    dateTime: {
                        timestamp?: number | undefined;
                        fallbackValue?: string | undefined;
                    };
                } | {
                    type: "image";
                    image: {
                        link: string;
                    };
                } | {
                    type: "document";
                    document: {
                        link: string;
                        filename?: string | undefined;
                    };
                } | {
                    type: "video";
                    video: {
                        link: string;
                    };
                })[] | undefined;
            }>, "many">>;
        }, "strict", z.ZodTypeAny, {
            name: string;
            namespace: string;
            language: {
                code: string;
                policy?: "fallback" | "deterministic" | undefined;
            };
            components?: {
                type: "button" | "body" | "footer" | "header";
                index?: string | undefined;
                subType?: "url" | "phone_number" | "quick_reply" | "copy_code" | undefined;
                parameters?: ({
                    type: "text";
                    text: string;
                } | {
                    type: "currency";
                    currency: {
                        amount1000: number;
                        currencyCode: string;
                    };
                } | {
                    type: "date_time";
                    dateTime: {
                        timestamp?: number | undefined;
                        fallbackValue?: string | undefined;
                    };
                } | {
                    type: "image";
                    image: {
                        link: string;
                    };
                } | {
                    type: "document";
                    document: {
                        link: string;
                        filename?: string | undefined;
                    };
                } | {
                    type: "video";
                    video: {
                        link: string;
                    };
                })[] | undefined;
            }[] | undefined;
        }, {
            name: string;
            namespace: string;
            language: {
                code: string;
                policy?: "fallback" | "deterministic" | undefined;
            };
            components?: {
                type: "button" | "body" | "footer" | "header";
                index?: string | undefined;
                subType?: "url" | "phone_number" | "quick_reply" | "copy_code" | undefined;
                parameters?: ({
                    type: "text";
                    text: string;
                } | {
                    type: "currency";
                    currency: {
                        amount1000: number;
                        currencyCode: string;
                    };
                } | {
                    type: "date_time";
                    dateTime: {
                        timestamp?: number | undefined;
                        fallbackValue?: string | undefined;
                    };
                } | {
                    type: "image";
                    image: {
                        link: string;
                    };
                } | {
                    type: "document";
                    document: {
                        link: string;
                        filename?: string | undefined;
                    };
                } | {
                    type: "video";
                    video: {
                        link: string;
                    };
                })[] | undefined;
            }[] | undefined;
        }>;
    }, "strict", z.ZodTypeAny, {
        type: "template";
        template: {
            name: string;
            namespace: string;
            language: {
                code: string;
                policy?: "fallback" | "deterministic" | undefined;
            };
            components?: {
                type: "button" | "body" | "footer" | "header";
                index?: string | undefined;
                subType?: "url" | "phone_number" | "quick_reply" | "copy_code" | undefined;
                parameters?: ({
                    type: "text";
                    text: string;
                } | {
                    type: "currency";
                    currency: {
                        amount1000: number;
                        currencyCode: string;
                    };
                } | {
                    type: "date_time";
                    dateTime: {
                        timestamp?: number | undefined;
                        fallbackValue?: string | undefined;
                    };
                } | {
                    type: "image";
                    image: {
                        link: string;
                    };
                } | {
                    type: "document";
                    document: {
                        link: string;
                        filename?: string | undefined;
                    };
                } | {
                    type: "video";
                    video: {
                        link: string;
                    };
                })[] | undefined;
            }[] | undefined;
        };
        text?: string | undefined;
        previewUrl?: boolean | undefined;
    }, {
        type: "template";
        template: {
            name: string;
            namespace: string;
            language: {
                code: string;
                policy?: "fallback" | "deterministic" | undefined;
            };
            components?: {
                type: "button" | "body" | "footer" | "header";
                index?: string | undefined;
                subType?: "url" | "phone_number" | "quick_reply" | "copy_code" | undefined;
                parameters?: ({
                    type: "text";
                    text: string;
                } | {
                    type: "currency";
                    currency: {
                        amount1000: number;
                        currencyCode: string;
                    };
                } | {
                    type: "date_time";
                    dateTime: {
                        timestamp?: number | undefined;
                        fallbackValue?: string | undefined;
                    };
                } | {
                    type: "image";
                    image: {
                        link: string;
                    };
                } | {
                    type: "document";
                    document: {
                        link: string;
                        filename?: string | undefined;
                    };
                } | {
                    type: "video";
                    video: {
                        link: string;
                    };
                })[] | undefined;
            }[] | undefined;
        };
        text?: string | undefined;
        previewUrl?: boolean | undefined;
    }>, z.ZodObject<{
        type: z.ZodLiteral<"poll">;
        poll: z.ZodObject<{
            question: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
            options: z.ZodArray<z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>, "many">;
            allowMultipleAnswers: z.ZodOptional<z.ZodBoolean>;
        }, "strict", z.ZodTypeAny, {
            options: string[];
            question: string;
            allowMultipleAnswers?: boolean | undefined;
        }, {
            options: string[];
            question: string;
            allowMultipleAnswers?: boolean | undefined;
        }>;
    }, "strict", z.ZodTypeAny, {
        type: "poll";
        poll: {
            options: string[];
            question: string;
            allowMultipleAnswers?: boolean | undefined;
        };
    }, {
        type: "poll";
        poll: {
            options: string[];
            question: string;
            allowMultipleAnswers?: boolean | undefined;
        };
    }>]>, {
        type: "image";
        mediaUrl: string;
        text?: string | undefined;
        caption?: string | undefined;
        previewUrl?: boolean | undefined;
        mimeType?: string | undefined;
        fileName?: string | undefined;
    } | {
        type: "document";
        mediaUrl: string;
        text?: string | undefined;
        caption?: string | undefined;
        previewUrl?: boolean | undefined;
        mimeType?: string | undefined;
        fileName?: string | undefined;
    } | {
        type: "audio";
        mediaUrl: string;
        text?: string | undefined;
        caption?: string | undefined;
        previewUrl?: boolean | undefined;
        mimeType?: string | undefined;
        fileName?: string | undefined;
    } | {
        type: "video";
        mediaUrl: string;
        text?: string | undefined;
        caption?: string | undefined;
        previewUrl?: boolean | undefined;
        mimeType?: string | undefined;
        fileName?: string | undefined;
    } | {
        type: "text";
        text: string;
        previewUrl?: boolean | undefined;
    } | {
        type: "location";
        location: {
            latitude: number;
            longitude: number;
            name?: string | undefined;
            url?: string | undefined;
            address?: string | undefined;
        };
        text?: string | undefined;
        previewUrl?: boolean | undefined;
    } | {
        type: "contact";
        contact: {
            organization?: string | undefined;
            fullName?: string | undefined;
            emails?: {
                email: string;
                type?: string | undefined;
            }[] | undefined;
            phones?: {
                phoneNumber: string;
                type?: string | undefined;
                waId?: string | undefined;
            }[] | undefined;
            vcard?: string | undefined;
        };
        text?: string | undefined;
        previewUrl?: boolean | undefined;
    } | {
        type: "template";
        template: {
            name: string;
            namespace: string;
            language: {
                code: string;
                policy?: "fallback" | "deterministic" | undefined;
            };
            components?: {
                type: "button" | "body" | "footer" | "header";
                index?: string | undefined;
                subType?: "url" | "phone_number" | "quick_reply" | "copy_code" | undefined;
                parameters?: ({
                    type: "text";
                    text: string;
                } | {
                    type: "currency";
                    currency: {
                        amount1000: number;
                        currencyCode: string;
                    };
                } | {
                    type: "date_time";
                    dateTime: {
                        timestamp?: number | undefined;
                        fallbackValue?: string | undefined;
                    };
                } | {
                    type: "image";
                    image: {
                        link: string;
                    };
                } | {
                    type: "document";
                    document: {
                        link: string;
                        filename?: string | undefined;
                    };
                } | {
                    type: "video";
                    video: {
                        link: string;
                    };
                })[] | undefined;
            }[] | undefined;
        };
        text?: string | undefined;
        previewUrl?: boolean | undefined;
    } | {
        type: "poll";
        poll: {
            options: string[];
            question: string;
            allowMultipleAnswers?: boolean | undefined;
        };
    }, unknown>;
    idempotencyKey: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
}, "strip", z.ZodTypeAny, {
    payload: {
        type: "image";
        mediaUrl: string;
        text?: string | undefined;
        caption?: string | undefined;
        previewUrl?: boolean | undefined;
        mimeType?: string | undefined;
        fileName?: string | undefined;
    } | {
        type: "document";
        mediaUrl: string;
        text?: string | undefined;
        caption?: string | undefined;
        previewUrl?: boolean | undefined;
        mimeType?: string | undefined;
        fileName?: string | undefined;
    } | {
        type: "audio";
        mediaUrl: string;
        text?: string | undefined;
        caption?: string | undefined;
        previewUrl?: boolean | undefined;
        mimeType?: string | undefined;
        fileName?: string | undefined;
    } | {
        type: "video";
        mediaUrl: string;
        text?: string | undefined;
        caption?: string | undefined;
        previewUrl?: boolean | undefined;
        mimeType?: string | undefined;
        fileName?: string | undefined;
    } | {
        type: "text";
        text: string;
        previewUrl?: boolean | undefined;
    } | {
        type: "location";
        location: {
            latitude: number;
            longitude: number;
            name?: string | undefined;
            url?: string | undefined;
            address?: string | undefined;
        };
        text?: string | undefined;
        previewUrl?: boolean | undefined;
    } | {
        type: "contact";
        contact: {
            organization?: string | undefined;
            fullName?: string | undefined;
            emails?: {
                email: string;
                type?: string | undefined;
            }[] | undefined;
            phones?: {
                phoneNumber: string;
                type?: string | undefined;
                waId?: string | undefined;
            }[] | undefined;
            vcard?: string | undefined;
        };
        text?: string | undefined;
        previewUrl?: boolean | undefined;
    } | {
        type: "template";
        template: {
            name: string;
            namespace: string;
            language: {
                code: string;
                policy?: "fallback" | "deterministic" | undefined;
            };
            components?: {
                type: "button" | "body" | "footer" | "header";
                index?: string | undefined;
                subType?: "url" | "phone_number" | "quick_reply" | "copy_code" | undefined;
                parameters?: ({
                    type: "text";
                    text: string;
                } | {
                    type: "currency";
                    currency: {
                        amount1000: number;
                        currencyCode: string;
                    };
                } | {
                    type: "date_time";
                    dateTime: {
                        timestamp?: number | undefined;
                        fallbackValue?: string | undefined;
                    };
                } | {
                    type: "image";
                    image: {
                        link: string;
                    };
                } | {
                    type: "document";
                    document: {
                        link: string;
                        filename?: string | undefined;
                    };
                } | {
                    type: "video";
                    video: {
                        link: string;
                    };
                })[] | undefined;
            }[] | undefined;
        };
        text?: string | undefined;
        previewUrl?: boolean | undefined;
    } | {
        type: "poll";
        poll: {
            options: string[];
            question: string;
            allowMultipleAnswers?: boolean | undefined;
        };
    };
    idempotencyKey: string;
    instanceId?: string | undefined;
}, {
    idempotencyKey: string;
    payload?: unknown;
    instanceId?: string | undefined;
}>;
export type SendByTicketInput = z.infer<typeof SendByTicketSchema>;
export declare const SendByContactSchema: z.ZodObject<{
    to: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
    instanceId: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
    payload: z.ZodEffects<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
        type: z.ZodLiteral<"text">;
        text: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
        previewUrl: z.ZodOptional<z.ZodBoolean>;
    }, "strict", z.ZodTypeAny, {
        type: "text";
        text: string;
        previewUrl?: boolean | undefined;
    }, {
        type: "text";
        text: string;
        previewUrl?: boolean | undefined;
    }>, z.ZodObject<{
        text: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
        caption: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
        mediaUrl: z.ZodString;
        mimeType: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
        fileName: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
        previewUrl: z.ZodOptional<z.ZodBoolean>;
    } & {
        type: z.ZodLiteral<"image">;
    }, "strict", z.ZodTypeAny, {
        type: "image";
        mediaUrl: string;
        text?: string | undefined;
        caption?: string | undefined;
        previewUrl?: boolean | undefined;
        mimeType?: string | undefined;
        fileName?: string | undefined;
    }, {
        type: "image";
        mediaUrl: string;
        text?: string | undefined;
        caption?: string | undefined;
        previewUrl?: boolean | undefined;
        mimeType?: string | undefined;
        fileName?: string | undefined;
    }>, z.ZodObject<{
        text: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
        caption: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
        mediaUrl: z.ZodString;
        mimeType: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
        fileName: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
        previewUrl: z.ZodOptional<z.ZodBoolean>;
    } & {
        type: z.ZodLiteral<"document">;
    }, "strict", z.ZodTypeAny, {
        type: "document";
        mediaUrl: string;
        text?: string | undefined;
        caption?: string | undefined;
        previewUrl?: boolean | undefined;
        mimeType?: string | undefined;
        fileName?: string | undefined;
    }, {
        type: "document";
        mediaUrl: string;
        text?: string | undefined;
        caption?: string | undefined;
        previewUrl?: boolean | undefined;
        mimeType?: string | undefined;
        fileName?: string | undefined;
    }>, z.ZodObject<{
        text: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
        caption: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
        mediaUrl: z.ZodString;
        mimeType: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
        fileName: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
        previewUrl: z.ZodOptional<z.ZodBoolean>;
    } & {
        type: z.ZodLiteral<"audio">;
    }, "strict", z.ZodTypeAny, {
        type: "audio";
        mediaUrl: string;
        text?: string | undefined;
        caption?: string | undefined;
        previewUrl?: boolean | undefined;
        mimeType?: string | undefined;
        fileName?: string | undefined;
    }, {
        type: "audio";
        mediaUrl: string;
        text?: string | undefined;
        caption?: string | undefined;
        previewUrl?: boolean | undefined;
        mimeType?: string | undefined;
        fileName?: string | undefined;
    }>, z.ZodObject<{
        text: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
        caption: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
        mediaUrl: z.ZodString;
        mimeType: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
        fileName: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
        previewUrl: z.ZodOptional<z.ZodBoolean>;
    } & {
        type: z.ZodLiteral<"video">;
    }, "strict", z.ZodTypeAny, {
        type: "video";
        mediaUrl: string;
        text?: string | undefined;
        caption?: string | undefined;
        previewUrl?: boolean | undefined;
        mimeType?: string | undefined;
        fileName?: string | undefined;
    }, {
        type: "video";
        mediaUrl: string;
        text?: string | undefined;
        caption?: string | undefined;
        previewUrl?: boolean | undefined;
        mimeType?: string | undefined;
        fileName?: string | undefined;
    }>, z.ZodObject<{
        type: z.ZodLiteral<"location">;
        text: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
        previewUrl: z.ZodOptional<z.ZodBoolean>;
        location: z.ZodObject<{
            latitude: z.ZodNumber;
            longitude: z.ZodNumber;
            name: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
            address: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
            url: z.ZodOptional<z.ZodString>;
        }, "strict", z.ZodTypeAny, {
            latitude: number;
            longitude: number;
            name?: string | undefined;
            url?: string | undefined;
            address?: string | undefined;
        }, {
            latitude: number;
            longitude: number;
            name?: string | undefined;
            url?: string | undefined;
            address?: string | undefined;
        }>;
    }, "strict", z.ZodTypeAny, {
        type: "location";
        location: {
            latitude: number;
            longitude: number;
            name?: string | undefined;
            url?: string | undefined;
            address?: string | undefined;
        };
        text?: string | undefined;
        previewUrl?: boolean | undefined;
    }, {
        type: "location";
        location: {
            latitude: number;
            longitude: number;
            name?: string | undefined;
            url?: string | undefined;
            address?: string | undefined;
        };
        text?: string | undefined;
        previewUrl?: boolean | undefined;
    }>, z.ZodObject<{
        type: z.ZodLiteral<"contact">;
        text: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
        previewUrl: z.ZodOptional<z.ZodBoolean>;
        contact: z.ZodEffects<z.ZodObject<{
            fullName: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
            organization: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
            emails: z.ZodOptional<z.ZodArray<z.ZodObject<{
                email: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
                type: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
            }, "strict", z.ZodTypeAny, {
                email: string;
                type?: string | undefined;
            }, {
                email: string;
                type?: string | undefined;
            }>, "many">>;
            phones: z.ZodOptional<z.ZodArray<z.ZodObject<{
                phoneNumber: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
                type: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
                waId: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
            }, "strict", z.ZodTypeAny, {
                phoneNumber: string;
                type?: string | undefined;
                waId?: string | undefined;
            }, {
                phoneNumber: string;
                type?: string | undefined;
                waId?: string | undefined;
            }>, "many">>;
            vcard: z.ZodOptional<z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>>;
        }, "strict", z.ZodTypeAny, {
            organization?: string | undefined;
            fullName?: string | undefined;
            emails?: {
                email: string;
                type?: string | undefined;
            }[] | undefined;
            phones?: {
                phoneNumber: string;
                type?: string | undefined;
                waId?: string | undefined;
            }[] | undefined;
            vcard?: string | undefined;
        }, {
            organization?: string | undefined;
            fullName?: string | undefined;
            emails?: {
                email: string;
                type?: string | undefined;
            }[] | undefined;
            phones?: {
                phoneNumber: string;
                type?: string | undefined;
                waId?: string | undefined;
            }[] | undefined;
            vcard?: string | undefined;
        }>, {
            organization?: string | undefined;
            fullName?: string | undefined;
            emails?: {
                email: string;
                type?: string | undefined;
            }[] | undefined;
            phones?: {
                phoneNumber: string;
                type?: string | undefined;
                waId?: string | undefined;
            }[] | undefined;
            vcard?: string | undefined;
        }, {
            organization?: string | undefined;
            fullName?: string | undefined;
            emails?: {
                email: string;
                type?: string | undefined;
            }[] | undefined;
            phones?: {
                phoneNumber: string;
                type?: string | undefined;
                waId?: string | undefined;
            }[] | undefined;
            vcard?: string | undefined;
        }>;
    }, "strict", z.ZodTypeAny, {
        type: "contact";
        contact: {
            organization?: string | undefined;
            fullName?: string | undefined;
            emails?: {
                email: string;
                type?: string | undefined;
            }[] | undefined;
            phones?: {
                phoneNumber: string;
                type?: string | undefined;
                waId?: string | undefined;
            }[] | undefined;
            vcard?: string | undefined;
        };
        text?: string | undefined;
        previewUrl?: boolean | undefined;
    }, {
        type: "contact";
        contact: {
            organization?: string | undefined;
            fullName?: string | undefined;
            emails?: {
                email: string;
                type?: string | undefined;
            }[] | undefined;
            phones?: {
                phoneNumber: string;
                type?: string | undefined;
                waId?: string | undefined;
            }[] | undefined;
            vcard?: string | undefined;
        };
        text?: string | undefined;
        previewUrl?: boolean | undefined;
    }>, z.ZodObject<{
        type: z.ZodLiteral<"template">;
        text: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
        previewUrl: z.ZodOptional<z.ZodBoolean>;
        template: z.ZodObject<{
            namespace: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
            name: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
            language: z.ZodObject<{
                code: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
                policy: z.ZodOptional<z.ZodEnum<["deterministic", "fallback"]>>;
            }, "strict", z.ZodTypeAny, {
                code: string;
                policy?: "fallback" | "deterministic" | undefined;
            }, {
                code: string;
                policy?: "fallback" | "deterministic" | undefined;
            }>;
            components: z.ZodOptional<z.ZodArray<z.ZodEffects<z.ZodObject<{
                type: z.ZodEnum<["header", "body", "footer", "button"]>;
                subType: z.ZodOptional<z.ZodEnum<["quick_reply", "url", "copy_code", "phone_number"]>>;
                index: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
                parameters: z.ZodOptional<z.ZodArray<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
                    type: z.ZodLiteral<"text">;
                    text: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
                }, "strict", z.ZodTypeAny, {
                    type: "text";
                    text: string;
                }, {
                    type: "text";
                    text: string;
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"currency">;
                    currency: z.ZodObject<{
                        amount1000: z.ZodNumber;
                        currencyCode: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
                    }, "strict", z.ZodTypeAny, {
                        amount1000: number;
                        currencyCode: string;
                    }, {
                        amount1000: number;
                        currencyCode: string;
                    }>;
                }, "strict", z.ZodTypeAny, {
                    type: "currency";
                    currency: {
                        amount1000: number;
                        currencyCode: string;
                    };
                }, {
                    type: "currency";
                    currency: {
                        amount1000: number;
                        currencyCode: string;
                    };
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"date_time">;
                    dateTime: z.ZodEffects<z.ZodObject<{
                        fallbackValue: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
                        timestamp: z.ZodOptional<z.ZodNumber>;
                    }, "strict", z.ZodTypeAny, {
                        timestamp?: number | undefined;
                        fallbackValue?: string | undefined;
                    }, {
                        timestamp?: number | undefined;
                        fallbackValue?: string | undefined;
                    }>, {
                        timestamp?: number | undefined;
                        fallbackValue?: string | undefined;
                    }, {
                        timestamp?: number | undefined;
                        fallbackValue?: string | undefined;
                    }>;
                }, "strict", z.ZodTypeAny, {
                    type: "date_time";
                    dateTime: {
                        timestamp?: number | undefined;
                        fallbackValue?: string | undefined;
                    };
                }, {
                    type: "date_time";
                    dateTime: {
                        timestamp?: number | undefined;
                        fallbackValue?: string | undefined;
                    };
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"image">;
                    image: z.ZodObject<{
                        link: z.ZodString;
                    }, "strict", z.ZodTypeAny, {
                        link: string;
                    }, {
                        link: string;
                    }>;
                }, "strict", z.ZodTypeAny, {
                    type: "image";
                    image: {
                        link: string;
                    };
                }, {
                    type: "image";
                    image: {
                        link: string;
                    };
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"document">;
                    document: z.ZodObject<{
                        link: z.ZodString;
                        filename: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
                    }, "strict", z.ZodTypeAny, {
                        link: string;
                        filename?: string | undefined;
                    }, {
                        link: string;
                        filename?: string | undefined;
                    }>;
                }, "strict", z.ZodTypeAny, {
                    type: "document";
                    document: {
                        link: string;
                        filename?: string | undefined;
                    };
                }, {
                    type: "document";
                    document: {
                        link: string;
                        filename?: string | undefined;
                    };
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"video">;
                    video: z.ZodObject<{
                        link: z.ZodString;
                    }, "strict", z.ZodTypeAny, {
                        link: string;
                    }, {
                        link: string;
                    }>;
                }, "strict", z.ZodTypeAny, {
                    type: "video";
                    video: {
                        link: string;
                    };
                }, {
                    type: "video";
                    video: {
                        link: string;
                    };
                }>]>, "many">>;
            }, "strict", z.ZodTypeAny, {
                type: "button" | "body" | "footer" | "header";
                index?: string | undefined;
                subType?: "url" | "phone_number" | "quick_reply" | "copy_code" | undefined;
                parameters?: ({
                    type: "text";
                    text: string;
                } | {
                    type: "currency";
                    currency: {
                        amount1000: number;
                        currencyCode: string;
                    };
                } | {
                    type: "date_time";
                    dateTime: {
                        timestamp?: number | undefined;
                        fallbackValue?: string | undefined;
                    };
                } | {
                    type: "image";
                    image: {
                        link: string;
                    };
                } | {
                    type: "document";
                    document: {
                        link: string;
                        filename?: string | undefined;
                    };
                } | {
                    type: "video";
                    video: {
                        link: string;
                    };
                })[] | undefined;
            }, {
                type: "button" | "body" | "footer" | "header";
                index?: string | undefined;
                subType?: "url" | "phone_number" | "quick_reply" | "copy_code" | undefined;
                parameters?: ({
                    type: "text";
                    text: string;
                } | {
                    type: "currency";
                    currency: {
                        amount1000: number;
                        currencyCode: string;
                    };
                } | {
                    type: "date_time";
                    dateTime: {
                        timestamp?: number | undefined;
                        fallbackValue?: string | undefined;
                    };
                } | {
                    type: "image";
                    image: {
                        link: string;
                    };
                } | {
                    type: "document";
                    document: {
                        link: string;
                        filename?: string | undefined;
                    };
                } | {
                    type: "video";
                    video: {
                        link: string;
                    };
                })[] | undefined;
            }>, {
                type: "button" | "body" | "footer" | "header";
                index?: string | undefined;
                subType?: "url" | "phone_number" | "quick_reply" | "copy_code" | undefined;
                parameters?: ({
                    type: "text";
                    text: string;
                } | {
                    type: "currency";
                    currency: {
                        amount1000: number;
                        currencyCode: string;
                    };
                } | {
                    type: "date_time";
                    dateTime: {
                        timestamp?: number | undefined;
                        fallbackValue?: string | undefined;
                    };
                } | {
                    type: "image";
                    image: {
                        link: string;
                    };
                } | {
                    type: "document";
                    document: {
                        link: string;
                        filename?: string | undefined;
                    };
                } | {
                    type: "video";
                    video: {
                        link: string;
                    };
                })[] | undefined;
            }, {
                type: "button" | "body" | "footer" | "header";
                index?: string | undefined;
                subType?: "url" | "phone_number" | "quick_reply" | "copy_code" | undefined;
                parameters?: ({
                    type: "text";
                    text: string;
                } | {
                    type: "currency";
                    currency: {
                        amount1000: number;
                        currencyCode: string;
                    };
                } | {
                    type: "date_time";
                    dateTime: {
                        timestamp?: number | undefined;
                        fallbackValue?: string | undefined;
                    };
                } | {
                    type: "image";
                    image: {
                        link: string;
                    };
                } | {
                    type: "document";
                    document: {
                        link: string;
                        filename?: string | undefined;
                    };
                } | {
                    type: "video";
                    video: {
                        link: string;
                    };
                })[] | undefined;
            }>, "many">>;
        }, "strict", z.ZodTypeAny, {
            name: string;
            namespace: string;
            language: {
                code: string;
                policy?: "fallback" | "deterministic" | undefined;
            };
            components?: {
                type: "button" | "body" | "footer" | "header";
                index?: string | undefined;
                subType?: "url" | "phone_number" | "quick_reply" | "copy_code" | undefined;
                parameters?: ({
                    type: "text";
                    text: string;
                } | {
                    type: "currency";
                    currency: {
                        amount1000: number;
                        currencyCode: string;
                    };
                } | {
                    type: "date_time";
                    dateTime: {
                        timestamp?: number | undefined;
                        fallbackValue?: string | undefined;
                    };
                } | {
                    type: "image";
                    image: {
                        link: string;
                    };
                } | {
                    type: "document";
                    document: {
                        link: string;
                        filename?: string | undefined;
                    };
                } | {
                    type: "video";
                    video: {
                        link: string;
                    };
                })[] | undefined;
            }[] | undefined;
        }, {
            name: string;
            namespace: string;
            language: {
                code: string;
                policy?: "fallback" | "deterministic" | undefined;
            };
            components?: {
                type: "button" | "body" | "footer" | "header";
                index?: string | undefined;
                subType?: "url" | "phone_number" | "quick_reply" | "copy_code" | undefined;
                parameters?: ({
                    type: "text";
                    text: string;
                } | {
                    type: "currency";
                    currency: {
                        amount1000: number;
                        currencyCode: string;
                    };
                } | {
                    type: "date_time";
                    dateTime: {
                        timestamp?: number | undefined;
                        fallbackValue?: string | undefined;
                    };
                } | {
                    type: "image";
                    image: {
                        link: string;
                    };
                } | {
                    type: "document";
                    document: {
                        link: string;
                        filename?: string | undefined;
                    };
                } | {
                    type: "video";
                    video: {
                        link: string;
                    };
                })[] | undefined;
            }[] | undefined;
        }>;
    }, "strict", z.ZodTypeAny, {
        type: "template";
        template: {
            name: string;
            namespace: string;
            language: {
                code: string;
                policy?: "fallback" | "deterministic" | undefined;
            };
            components?: {
                type: "button" | "body" | "footer" | "header";
                index?: string | undefined;
                subType?: "url" | "phone_number" | "quick_reply" | "copy_code" | undefined;
                parameters?: ({
                    type: "text";
                    text: string;
                } | {
                    type: "currency";
                    currency: {
                        amount1000: number;
                        currencyCode: string;
                    };
                } | {
                    type: "date_time";
                    dateTime: {
                        timestamp?: number | undefined;
                        fallbackValue?: string | undefined;
                    };
                } | {
                    type: "image";
                    image: {
                        link: string;
                    };
                } | {
                    type: "document";
                    document: {
                        link: string;
                        filename?: string | undefined;
                    };
                } | {
                    type: "video";
                    video: {
                        link: string;
                    };
                })[] | undefined;
            }[] | undefined;
        };
        text?: string | undefined;
        previewUrl?: boolean | undefined;
    }, {
        type: "template";
        template: {
            name: string;
            namespace: string;
            language: {
                code: string;
                policy?: "fallback" | "deterministic" | undefined;
            };
            components?: {
                type: "button" | "body" | "footer" | "header";
                index?: string | undefined;
                subType?: "url" | "phone_number" | "quick_reply" | "copy_code" | undefined;
                parameters?: ({
                    type: "text";
                    text: string;
                } | {
                    type: "currency";
                    currency: {
                        amount1000: number;
                        currencyCode: string;
                    };
                } | {
                    type: "date_time";
                    dateTime: {
                        timestamp?: number | undefined;
                        fallbackValue?: string | undefined;
                    };
                } | {
                    type: "image";
                    image: {
                        link: string;
                    };
                } | {
                    type: "document";
                    document: {
                        link: string;
                        filename?: string | undefined;
                    };
                } | {
                    type: "video";
                    video: {
                        link: string;
                    };
                })[] | undefined;
            }[] | undefined;
        };
        text?: string | undefined;
        previewUrl?: boolean | undefined;
    }>, z.ZodObject<{
        type: z.ZodLiteral<"poll">;
        poll: z.ZodObject<{
            question: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
            options: z.ZodArray<z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>, "many">;
            allowMultipleAnswers: z.ZodOptional<z.ZodBoolean>;
        }, "strict", z.ZodTypeAny, {
            options: string[];
            question: string;
            allowMultipleAnswers?: boolean | undefined;
        }, {
            options: string[];
            question: string;
            allowMultipleAnswers?: boolean | undefined;
        }>;
    }, "strict", z.ZodTypeAny, {
        type: "poll";
        poll: {
            options: string[];
            question: string;
            allowMultipleAnswers?: boolean | undefined;
        };
    }, {
        type: "poll";
        poll: {
            options: string[];
            question: string;
            allowMultipleAnswers?: boolean | undefined;
        };
    }>]>, {
        type: "image";
        mediaUrl: string;
        text?: string | undefined;
        caption?: string | undefined;
        previewUrl?: boolean | undefined;
        mimeType?: string | undefined;
        fileName?: string | undefined;
    } | {
        type: "document";
        mediaUrl: string;
        text?: string | undefined;
        caption?: string | undefined;
        previewUrl?: boolean | undefined;
        mimeType?: string | undefined;
        fileName?: string | undefined;
    } | {
        type: "audio";
        mediaUrl: string;
        text?: string | undefined;
        caption?: string | undefined;
        previewUrl?: boolean | undefined;
        mimeType?: string | undefined;
        fileName?: string | undefined;
    } | {
        type: "video";
        mediaUrl: string;
        text?: string | undefined;
        caption?: string | undefined;
        previewUrl?: boolean | undefined;
        mimeType?: string | undefined;
        fileName?: string | undefined;
    } | {
        type: "text";
        text: string;
        previewUrl?: boolean | undefined;
    } | {
        type: "location";
        location: {
            latitude: number;
            longitude: number;
            name?: string | undefined;
            url?: string | undefined;
            address?: string | undefined;
        };
        text?: string | undefined;
        previewUrl?: boolean | undefined;
    } | {
        type: "contact";
        contact: {
            organization?: string | undefined;
            fullName?: string | undefined;
            emails?: {
                email: string;
                type?: string | undefined;
            }[] | undefined;
            phones?: {
                phoneNumber: string;
                type?: string | undefined;
                waId?: string | undefined;
            }[] | undefined;
            vcard?: string | undefined;
        };
        text?: string | undefined;
        previewUrl?: boolean | undefined;
    } | {
        type: "template";
        template: {
            name: string;
            namespace: string;
            language: {
                code: string;
                policy?: "fallback" | "deterministic" | undefined;
            };
            components?: {
                type: "button" | "body" | "footer" | "header";
                index?: string | undefined;
                subType?: "url" | "phone_number" | "quick_reply" | "copy_code" | undefined;
                parameters?: ({
                    type: "text";
                    text: string;
                } | {
                    type: "currency";
                    currency: {
                        amount1000: number;
                        currencyCode: string;
                    };
                } | {
                    type: "date_time";
                    dateTime: {
                        timestamp?: number | undefined;
                        fallbackValue?: string | undefined;
                    };
                } | {
                    type: "image";
                    image: {
                        link: string;
                    };
                } | {
                    type: "document";
                    document: {
                        link: string;
                        filename?: string | undefined;
                    };
                } | {
                    type: "video";
                    video: {
                        link: string;
                    };
                })[] | undefined;
            }[] | undefined;
        };
        text?: string | undefined;
        previewUrl?: boolean | undefined;
    } | {
        type: "poll";
        poll: {
            options: string[];
            question: string;
            allowMultipleAnswers?: boolean | undefined;
        };
    }, unknown>;
    idempotencyKey: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
}, "strip", z.ZodTypeAny, {
    payload: {
        type: "image";
        mediaUrl: string;
        text?: string | undefined;
        caption?: string | undefined;
        previewUrl?: boolean | undefined;
        mimeType?: string | undefined;
        fileName?: string | undefined;
    } | {
        type: "document";
        mediaUrl: string;
        text?: string | undefined;
        caption?: string | undefined;
        previewUrl?: boolean | undefined;
        mimeType?: string | undefined;
        fileName?: string | undefined;
    } | {
        type: "audio";
        mediaUrl: string;
        text?: string | undefined;
        caption?: string | undefined;
        previewUrl?: boolean | undefined;
        mimeType?: string | undefined;
        fileName?: string | undefined;
    } | {
        type: "video";
        mediaUrl: string;
        text?: string | undefined;
        caption?: string | undefined;
        previewUrl?: boolean | undefined;
        mimeType?: string | undefined;
        fileName?: string | undefined;
    } | {
        type: "text";
        text: string;
        previewUrl?: boolean | undefined;
    } | {
        type: "location";
        location: {
            latitude: number;
            longitude: number;
            name?: string | undefined;
            url?: string | undefined;
            address?: string | undefined;
        };
        text?: string | undefined;
        previewUrl?: boolean | undefined;
    } | {
        type: "contact";
        contact: {
            organization?: string | undefined;
            fullName?: string | undefined;
            emails?: {
                email: string;
                type?: string | undefined;
            }[] | undefined;
            phones?: {
                phoneNumber: string;
                type?: string | undefined;
                waId?: string | undefined;
            }[] | undefined;
            vcard?: string | undefined;
        };
        text?: string | undefined;
        previewUrl?: boolean | undefined;
    } | {
        type: "template";
        template: {
            name: string;
            namespace: string;
            language: {
                code: string;
                policy?: "fallback" | "deterministic" | undefined;
            };
            components?: {
                type: "button" | "body" | "footer" | "header";
                index?: string | undefined;
                subType?: "url" | "phone_number" | "quick_reply" | "copy_code" | undefined;
                parameters?: ({
                    type: "text";
                    text: string;
                } | {
                    type: "currency";
                    currency: {
                        amount1000: number;
                        currencyCode: string;
                    };
                } | {
                    type: "date_time";
                    dateTime: {
                        timestamp?: number | undefined;
                        fallbackValue?: string | undefined;
                    };
                } | {
                    type: "image";
                    image: {
                        link: string;
                    };
                } | {
                    type: "document";
                    document: {
                        link: string;
                        filename?: string | undefined;
                    };
                } | {
                    type: "video";
                    video: {
                        link: string;
                    };
                })[] | undefined;
            }[] | undefined;
        };
        text?: string | undefined;
        previewUrl?: boolean | undefined;
    } | {
        type: "poll";
        poll: {
            options: string[];
            question: string;
            allowMultipleAnswers?: boolean | undefined;
        };
    };
    to: string;
    instanceId?: string | undefined;
    idempotencyKey?: string | undefined;
}, {
    to: string;
    payload?: unknown;
    instanceId?: string | undefined;
    idempotencyKey?: string | undefined;
}>;
export type SendByContactInput = z.infer<typeof SendByContactSchema>;
export declare const SendByInstanceSchema: z.ZodObject<{
    to: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
    payload: z.ZodEffects<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
        type: z.ZodLiteral<"text">;
        text: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
        previewUrl: z.ZodOptional<z.ZodBoolean>;
    }, "strict", z.ZodTypeAny, {
        type: "text";
        text: string;
        previewUrl?: boolean | undefined;
    }, {
        type: "text";
        text: string;
        previewUrl?: boolean | undefined;
    }>, z.ZodObject<{
        text: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
        caption: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
        mediaUrl: z.ZodString;
        mimeType: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
        fileName: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
        previewUrl: z.ZodOptional<z.ZodBoolean>;
    } & {
        type: z.ZodLiteral<"image">;
    }, "strict", z.ZodTypeAny, {
        type: "image";
        mediaUrl: string;
        text?: string | undefined;
        caption?: string | undefined;
        previewUrl?: boolean | undefined;
        mimeType?: string | undefined;
        fileName?: string | undefined;
    }, {
        type: "image";
        mediaUrl: string;
        text?: string | undefined;
        caption?: string | undefined;
        previewUrl?: boolean | undefined;
        mimeType?: string | undefined;
        fileName?: string | undefined;
    }>, z.ZodObject<{
        text: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
        caption: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
        mediaUrl: z.ZodString;
        mimeType: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
        fileName: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
        previewUrl: z.ZodOptional<z.ZodBoolean>;
    } & {
        type: z.ZodLiteral<"document">;
    }, "strict", z.ZodTypeAny, {
        type: "document";
        mediaUrl: string;
        text?: string | undefined;
        caption?: string | undefined;
        previewUrl?: boolean | undefined;
        mimeType?: string | undefined;
        fileName?: string | undefined;
    }, {
        type: "document";
        mediaUrl: string;
        text?: string | undefined;
        caption?: string | undefined;
        previewUrl?: boolean | undefined;
        mimeType?: string | undefined;
        fileName?: string | undefined;
    }>, z.ZodObject<{
        text: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
        caption: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
        mediaUrl: z.ZodString;
        mimeType: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
        fileName: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
        previewUrl: z.ZodOptional<z.ZodBoolean>;
    } & {
        type: z.ZodLiteral<"audio">;
    }, "strict", z.ZodTypeAny, {
        type: "audio";
        mediaUrl: string;
        text?: string | undefined;
        caption?: string | undefined;
        previewUrl?: boolean | undefined;
        mimeType?: string | undefined;
        fileName?: string | undefined;
    }, {
        type: "audio";
        mediaUrl: string;
        text?: string | undefined;
        caption?: string | undefined;
        previewUrl?: boolean | undefined;
        mimeType?: string | undefined;
        fileName?: string | undefined;
    }>, z.ZodObject<{
        text: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
        caption: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
        mediaUrl: z.ZodString;
        mimeType: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
        fileName: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
        previewUrl: z.ZodOptional<z.ZodBoolean>;
    } & {
        type: z.ZodLiteral<"video">;
    }, "strict", z.ZodTypeAny, {
        type: "video";
        mediaUrl: string;
        text?: string | undefined;
        caption?: string | undefined;
        previewUrl?: boolean | undefined;
        mimeType?: string | undefined;
        fileName?: string | undefined;
    }, {
        type: "video";
        mediaUrl: string;
        text?: string | undefined;
        caption?: string | undefined;
        previewUrl?: boolean | undefined;
        mimeType?: string | undefined;
        fileName?: string | undefined;
    }>, z.ZodObject<{
        type: z.ZodLiteral<"location">;
        text: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
        previewUrl: z.ZodOptional<z.ZodBoolean>;
        location: z.ZodObject<{
            latitude: z.ZodNumber;
            longitude: z.ZodNumber;
            name: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
            address: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
            url: z.ZodOptional<z.ZodString>;
        }, "strict", z.ZodTypeAny, {
            latitude: number;
            longitude: number;
            name?: string | undefined;
            url?: string | undefined;
            address?: string | undefined;
        }, {
            latitude: number;
            longitude: number;
            name?: string | undefined;
            url?: string | undefined;
            address?: string | undefined;
        }>;
    }, "strict", z.ZodTypeAny, {
        type: "location";
        location: {
            latitude: number;
            longitude: number;
            name?: string | undefined;
            url?: string | undefined;
            address?: string | undefined;
        };
        text?: string | undefined;
        previewUrl?: boolean | undefined;
    }, {
        type: "location";
        location: {
            latitude: number;
            longitude: number;
            name?: string | undefined;
            url?: string | undefined;
            address?: string | undefined;
        };
        text?: string | undefined;
        previewUrl?: boolean | undefined;
    }>, z.ZodObject<{
        type: z.ZodLiteral<"contact">;
        text: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
        previewUrl: z.ZodOptional<z.ZodBoolean>;
        contact: z.ZodEffects<z.ZodObject<{
            fullName: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
            organization: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
            emails: z.ZodOptional<z.ZodArray<z.ZodObject<{
                email: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
                type: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
            }, "strict", z.ZodTypeAny, {
                email: string;
                type?: string | undefined;
            }, {
                email: string;
                type?: string | undefined;
            }>, "many">>;
            phones: z.ZodOptional<z.ZodArray<z.ZodObject<{
                phoneNumber: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
                type: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
                waId: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
            }, "strict", z.ZodTypeAny, {
                phoneNumber: string;
                type?: string | undefined;
                waId?: string | undefined;
            }, {
                phoneNumber: string;
                type?: string | undefined;
                waId?: string | undefined;
            }>, "many">>;
            vcard: z.ZodOptional<z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>>;
        }, "strict", z.ZodTypeAny, {
            organization?: string | undefined;
            fullName?: string | undefined;
            emails?: {
                email: string;
                type?: string | undefined;
            }[] | undefined;
            phones?: {
                phoneNumber: string;
                type?: string | undefined;
                waId?: string | undefined;
            }[] | undefined;
            vcard?: string | undefined;
        }, {
            organization?: string | undefined;
            fullName?: string | undefined;
            emails?: {
                email: string;
                type?: string | undefined;
            }[] | undefined;
            phones?: {
                phoneNumber: string;
                type?: string | undefined;
                waId?: string | undefined;
            }[] | undefined;
            vcard?: string | undefined;
        }>, {
            organization?: string | undefined;
            fullName?: string | undefined;
            emails?: {
                email: string;
                type?: string | undefined;
            }[] | undefined;
            phones?: {
                phoneNumber: string;
                type?: string | undefined;
                waId?: string | undefined;
            }[] | undefined;
            vcard?: string | undefined;
        }, {
            organization?: string | undefined;
            fullName?: string | undefined;
            emails?: {
                email: string;
                type?: string | undefined;
            }[] | undefined;
            phones?: {
                phoneNumber: string;
                type?: string | undefined;
                waId?: string | undefined;
            }[] | undefined;
            vcard?: string | undefined;
        }>;
    }, "strict", z.ZodTypeAny, {
        type: "contact";
        contact: {
            organization?: string | undefined;
            fullName?: string | undefined;
            emails?: {
                email: string;
                type?: string | undefined;
            }[] | undefined;
            phones?: {
                phoneNumber: string;
                type?: string | undefined;
                waId?: string | undefined;
            }[] | undefined;
            vcard?: string | undefined;
        };
        text?: string | undefined;
        previewUrl?: boolean | undefined;
    }, {
        type: "contact";
        contact: {
            organization?: string | undefined;
            fullName?: string | undefined;
            emails?: {
                email: string;
                type?: string | undefined;
            }[] | undefined;
            phones?: {
                phoneNumber: string;
                type?: string | undefined;
                waId?: string | undefined;
            }[] | undefined;
            vcard?: string | undefined;
        };
        text?: string | undefined;
        previewUrl?: boolean | undefined;
    }>, z.ZodObject<{
        type: z.ZodLiteral<"template">;
        text: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
        previewUrl: z.ZodOptional<z.ZodBoolean>;
        template: z.ZodObject<{
            namespace: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
            name: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
            language: z.ZodObject<{
                code: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
                policy: z.ZodOptional<z.ZodEnum<["deterministic", "fallback"]>>;
            }, "strict", z.ZodTypeAny, {
                code: string;
                policy?: "fallback" | "deterministic" | undefined;
            }, {
                code: string;
                policy?: "fallback" | "deterministic" | undefined;
            }>;
            components: z.ZodOptional<z.ZodArray<z.ZodEffects<z.ZodObject<{
                type: z.ZodEnum<["header", "body", "footer", "button"]>;
                subType: z.ZodOptional<z.ZodEnum<["quick_reply", "url", "copy_code", "phone_number"]>>;
                index: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
                parameters: z.ZodOptional<z.ZodArray<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
                    type: z.ZodLiteral<"text">;
                    text: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
                }, "strict", z.ZodTypeAny, {
                    type: "text";
                    text: string;
                }, {
                    type: "text";
                    text: string;
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"currency">;
                    currency: z.ZodObject<{
                        amount1000: z.ZodNumber;
                        currencyCode: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
                    }, "strict", z.ZodTypeAny, {
                        amount1000: number;
                        currencyCode: string;
                    }, {
                        amount1000: number;
                        currencyCode: string;
                    }>;
                }, "strict", z.ZodTypeAny, {
                    type: "currency";
                    currency: {
                        amount1000: number;
                        currencyCode: string;
                    };
                }, {
                    type: "currency";
                    currency: {
                        amount1000: number;
                        currencyCode: string;
                    };
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"date_time">;
                    dateTime: z.ZodEffects<z.ZodObject<{
                        fallbackValue: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
                        timestamp: z.ZodOptional<z.ZodNumber>;
                    }, "strict", z.ZodTypeAny, {
                        timestamp?: number | undefined;
                        fallbackValue?: string | undefined;
                    }, {
                        timestamp?: number | undefined;
                        fallbackValue?: string | undefined;
                    }>, {
                        timestamp?: number | undefined;
                        fallbackValue?: string | undefined;
                    }, {
                        timestamp?: number | undefined;
                        fallbackValue?: string | undefined;
                    }>;
                }, "strict", z.ZodTypeAny, {
                    type: "date_time";
                    dateTime: {
                        timestamp?: number | undefined;
                        fallbackValue?: string | undefined;
                    };
                }, {
                    type: "date_time";
                    dateTime: {
                        timestamp?: number | undefined;
                        fallbackValue?: string | undefined;
                    };
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"image">;
                    image: z.ZodObject<{
                        link: z.ZodString;
                    }, "strict", z.ZodTypeAny, {
                        link: string;
                    }, {
                        link: string;
                    }>;
                }, "strict", z.ZodTypeAny, {
                    type: "image";
                    image: {
                        link: string;
                    };
                }, {
                    type: "image";
                    image: {
                        link: string;
                    };
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"document">;
                    document: z.ZodObject<{
                        link: z.ZodString;
                        filename: z.ZodEffects<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, string | undefined, string | undefined>;
                    }, "strict", z.ZodTypeAny, {
                        link: string;
                        filename?: string | undefined;
                    }, {
                        link: string;
                        filename?: string | undefined;
                    }>;
                }, "strict", z.ZodTypeAny, {
                    type: "document";
                    document: {
                        link: string;
                        filename?: string | undefined;
                    };
                }, {
                    type: "document";
                    document: {
                        link: string;
                        filename?: string | undefined;
                    };
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"video">;
                    video: z.ZodObject<{
                        link: z.ZodString;
                    }, "strict", z.ZodTypeAny, {
                        link: string;
                    }, {
                        link: string;
                    }>;
                }, "strict", z.ZodTypeAny, {
                    type: "video";
                    video: {
                        link: string;
                    };
                }, {
                    type: "video";
                    video: {
                        link: string;
                    };
                }>]>, "many">>;
            }, "strict", z.ZodTypeAny, {
                type: "button" | "body" | "footer" | "header";
                index?: string | undefined;
                subType?: "url" | "phone_number" | "quick_reply" | "copy_code" | undefined;
                parameters?: ({
                    type: "text";
                    text: string;
                } | {
                    type: "currency";
                    currency: {
                        amount1000: number;
                        currencyCode: string;
                    };
                } | {
                    type: "date_time";
                    dateTime: {
                        timestamp?: number | undefined;
                        fallbackValue?: string | undefined;
                    };
                } | {
                    type: "image";
                    image: {
                        link: string;
                    };
                } | {
                    type: "document";
                    document: {
                        link: string;
                        filename?: string | undefined;
                    };
                } | {
                    type: "video";
                    video: {
                        link: string;
                    };
                })[] | undefined;
            }, {
                type: "button" | "body" | "footer" | "header";
                index?: string | undefined;
                subType?: "url" | "phone_number" | "quick_reply" | "copy_code" | undefined;
                parameters?: ({
                    type: "text";
                    text: string;
                } | {
                    type: "currency";
                    currency: {
                        amount1000: number;
                        currencyCode: string;
                    };
                } | {
                    type: "date_time";
                    dateTime: {
                        timestamp?: number | undefined;
                        fallbackValue?: string | undefined;
                    };
                } | {
                    type: "image";
                    image: {
                        link: string;
                    };
                } | {
                    type: "document";
                    document: {
                        link: string;
                        filename?: string | undefined;
                    };
                } | {
                    type: "video";
                    video: {
                        link: string;
                    };
                })[] | undefined;
            }>, {
                type: "button" | "body" | "footer" | "header";
                index?: string | undefined;
                subType?: "url" | "phone_number" | "quick_reply" | "copy_code" | undefined;
                parameters?: ({
                    type: "text";
                    text: string;
                } | {
                    type: "currency";
                    currency: {
                        amount1000: number;
                        currencyCode: string;
                    };
                } | {
                    type: "date_time";
                    dateTime: {
                        timestamp?: number | undefined;
                        fallbackValue?: string | undefined;
                    };
                } | {
                    type: "image";
                    image: {
                        link: string;
                    };
                } | {
                    type: "document";
                    document: {
                        link: string;
                        filename?: string | undefined;
                    };
                } | {
                    type: "video";
                    video: {
                        link: string;
                    };
                })[] | undefined;
            }, {
                type: "button" | "body" | "footer" | "header";
                index?: string | undefined;
                subType?: "url" | "phone_number" | "quick_reply" | "copy_code" | undefined;
                parameters?: ({
                    type: "text";
                    text: string;
                } | {
                    type: "currency";
                    currency: {
                        amount1000: number;
                        currencyCode: string;
                    };
                } | {
                    type: "date_time";
                    dateTime: {
                        timestamp?: number | undefined;
                        fallbackValue?: string | undefined;
                    };
                } | {
                    type: "image";
                    image: {
                        link: string;
                    };
                } | {
                    type: "document";
                    document: {
                        link: string;
                        filename?: string | undefined;
                    };
                } | {
                    type: "video";
                    video: {
                        link: string;
                    };
                })[] | undefined;
            }>, "many">>;
        }, "strict", z.ZodTypeAny, {
            name: string;
            namespace: string;
            language: {
                code: string;
                policy?: "fallback" | "deterministic" | undefined;
            };
            components?: {
                type: "button" | "body" | "footer" | "header";
                index?: string | undefined;
                subType?: "url" | "phone_number" | "quick_reply" | "copy_code" | undefined;
                parameters?: ({
                    type: "text";
                    text: string;
                } | {
                    type: "currency";
                    currency: {
                        amount1000: number;
                        currencyCode: string;
                    };
                } | {
                    type: "date_time";
                    dateTime: {
                        timestamp?: number | undefined;
                        fallbackValue?: string | undefined;
                    };
                } | {
                    type: "image";
                    image: {
                        link: string;
                    };
                } | {
                    type: "document";
                    document: {
                        link: string;
                        filename?: string | undefined;
                    };
                } | {
                    type: "video";
                    video: {
                        link: string;
                    };
                })[] | undefined;
            }[] | undefined;
        }, {
            name: string;
            namespace: string;
            language: {
                code: string;
                policy?: "fallback" | "deterministic" | undefined;
            };
            components?: {
                type: "button" | "body" | "footer" | "header";
                index?: string | undefined;
                subType?: "url" | "phone_number" | "quick_reply" | "copy_code" | undefined;
                parameters?: ({
                    type: "text";
                    text: string;
                } | {
                    type: "currency";
                    currency: {
                        amount1000: number;
                        currencyCode: string;
                    };
                } | {
                    type: "date_time";
                    dateTime: {
                        timestamp?: number | undefined;
                        fallbackValue?: string | undefined;
                    };
                } | {
                    type: "image";
                    image: {
                        link: string;
                    };
                } | {
                    type: "document";
                    document: {
                        link: string;
                        filename?: string | undefined;
                    };
                } | {
                    type: "video";
                    video: {
                        link: string;
                    };
                })[] | undefined;
            }[] | undefined;
        }>;
    }, "strict", z.ZodTypeAny, {
        type: "template";
        template: {
            name: string;
            namespace: string;
            language: {
                code: string;
                policy?: "fallback" | "deterministic" | undefined;
            };
            components?: {
                type: "button" | "body" | "footer" | "header";
                index?: string | undefined;
                subType?: "url" | "phone_number" | "quick_reply" | "copy_code" | undefined;
                parameters?: ({
                    type: "text";
                    text: string;
                } | {
                    type: "currency";
                    currency: {
                        amount1000: number;
                        currencyCode: string;
                    };
                } | {
                    type: "date_time";
                    dateTime: {
                        timestamp?: number | undefined;
                        fallbackValue?: string | undefined;
                    };
                } | {
                    type: "image";
                    image: {
                        link: string;
                    };
                } | {
                    type: "document";
                    document: {
                        link: string;
                        filename?: string | undefined;
                    };
                } | {
                    type: "video";
                    video: {
                        link: string;
                    };
                })[] | undefined;
            }[] | undefined;
        };
        text?: string | undefined;
        previewUrl?: boolean | undefined;
    }, {
        type: "template";
        template: {
            name: string;
            namespace: string;
            language: {
                code: string;
                policy?: "fallback" | "deterministic" | undefined;
            };
            components?: {
                type: "button" | "body" | "footer" | "header";
                index?: string | undefined;
                subType?: "url" | "phone_number" | "quick_reply" | "copy_code" | undefined;
                parameters?: ({
                    type: "text";
                    text: string;
                } | {
                    type: "currency";
                    currency: {
                        amount1000: number;
                        currencyCode: string;
                    };
                } | {
                    type: "date_time";
                    dateTime: {
                        timestamp?: number | undefined;
                        fallbackValue?: string | undefined;
                    };
                } | {
                    type: "image";
                    image: {
                        link: string;
                    };
                } | {
                    type: "document";
                    document: {
                        link: string;
                        filename?: string | undefined;
                    };
                } | {
                    type: "video";
                    video: {
                        link: string;
                    };
                })[] | undefined;
            }[] | undefined;
        };
        text?: string | undefined;
        previewUrl?: boolean | undefined;
    }>, z.ZodObject<{
        type: z.ZodLiteral<"poll">;
        poll: z.ZodObject<{
            question: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
            options: z.ZodArray<z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>, "many">;
            allowMultipleAnswers: z.ZodOptional<z.ZodBoolean>;
        }, "strict", z.ZodTypeAny, {
            options: string[];
            question: string;
            allowMultipleAnswers?: boolean | undefined;
        }, {
            options: string[];
            question: string;
            allowMultipleAnswers?: boolean | undefined;
        }>;
    }, "strict", z.ZodTypeAny, {
        type: "poll";
        poll: {
            options: string[];
            question: string;
            allowMultipleAnswers?: boolean | undefined;
        };
    }, {
        type: "poll";
        poll: {
            options: string[];
            question: string;
            allowMultipleAnswers?: boolean | undefined;
        };
    }>]>, {
        type: "image";
        mediaUrl: string;
        text?: string | undefined;
        caption?: string | undefined;
        previewUrl?: boolean | undefined;
        mimeType?: string | undefined;
        fileName?: string | undefined;
    } | {
        type: "document";
        mediaUrl: string;
        text?: string | undefined;
        caption?: string | undefined;
        previewUrl?: boolean | undefined;
        mimeType?: string | undefined;
        fileName?: string | undefined;
    } | {
        type: "audio";
        mediaUrl: string;
        text?: string | undefined;
        caption?: string | undefined;
        previewUrl?: boolean | undefined;
        mimeType?: string | undefined;
        fileName?: string | undefined;
    } | {
        type: "video";
        mediaUrl: string;
        text?: string | undefined;
        caption?: string | undefined;
        previewUrl?: boolean | undefined;
        mimeType?: string | undefined;
        fileName?: string | undefined;
    } | {
        type: "text";
        text: string;
        previewUrl?: boolean | undefined;
    } | {
        type: "location";
        location: {
            latitude: number;
            longitude: number;
            name?: string | undefined;
            url?: string | undefined;
            address?: string | undefined;
        };
        text?: string | undefined;
        previewUrl?: boolean | undefined;
    } | {
        type: "contact";
        contact: {
            organization?: string | undefined;
            fullName?: string | undefined;
            emails?: {
                email: string;
                type?: string | undefined;
            }[] | undefined;
            phones?: {
                phoneNumber: string;
                type?: string | undefined;
                waId?: string | undefined;
            }[] | undefined;
            vcard?: string | undefined;
        };
        text?: string | undefined;
        previewUrl?: boolean | undefined;
    } | {
        type: "template";
        template: {
            name: string;
            namespace: string;
            language: {
                code: string;
                policy?: "fallback" | "deterministic" | undefined;
            };
            components?: {
                type: "button" | "body" | "footer" | "header";
                index?: string | undefined;
                subType?: "url" | "phone_number" | "quick_reply" | "copy_code" | undefined;
                parameters?: ({
                    type: "text";
                    text: string;
                } | {
                    type: "currency";
                    currency: {
                        amount1000: number;
                        currencyCode: string;
                    };
                } | {
                    type: "date_time";
                    dateTime: {
                        timestamp?: number | undefined;
                        fallbackValue?: string | undefined;
                    };
                } | {
                    type: "image";
                    image: {
                        link: string;
                    };
                } | {
                    type: "document";
                    document: {
                        link: string;
                        filename?: string | undefined;
                    };
                } | {
                    type: "video";
                    video: {
                        link: string;
                    };
                })[] | undefined;
            }[] | undefined;
        };
        text?: string | undefined;
        previewUrl?: boolean | undefined;
    } | {
        type: "poll";
        poll: {
            options: string[];
            question: string;
            allowMultipleAnswers?: boolean | undefined;
        };
    }, unknown>;
    idempotencyKey: z.ZodPipeline<z.ZodEffects<z.ZodString, string, string>, z.ZodString>;
}, "strip", z.ZodTypeAny, {
    payload: {
        type: "image";
        mediaUrl: string;
        text?: string | undefined;
        caption?: string | undefined;
        previewUrl?: boolean | undefined;
        mimeType?: string | undefined;
        fileName?: string | undefined;
    } | {
        type: "document";
        mediaUrl: string;
        text?: string | undefined;
        caption?: string | undefined;
        previewUrl?: boolean | undefined;
        mimeType?: string | undefined;
        fileName?: string | undefined;
    } | {
        type: "audio";
        mediaUrl: string;
        text?: string | undefined;
        caption?: string | undefined;
        previewUrl?: boolean | undefined;
        mimeType?: string | undefined;
        fileName?: string | undefined;
    } | {
        type: "video";
        mediaUrl: string;
        text?: string | undefined;
        caption?: string | undefined;
        previewUrl?: boolean | undefined;
        mimeType?: string | undefined;
        fileName?: string | undefined;
    } | {
        type: "text";
        text: string;
        previewUrl?: boolean | undefined;
    } | {
        type: "location";
        location: {
            latitude: number;
            longitude: number;
            name?: string | undefined;
            url?: string | undefined;
            address?: string | undefined;
        };
        text?: string | undefined;
        previewUrl?: boolean | undefined;
    } | {
        type: "contact";
        contact: {
            organization?: string | undefined;
            fullName?: string | undefined;
            emails?: {
                email: string;
                type?: string | undefined;
            }[] | undefined;
            phones?: {
                phoneNumber: string;
                type?: string | undefined;
                waId?: string | undefined;
            }[] | undefined;
            vcard?: string | undefined;
        };
        text?: string | undefined;
        previewUrl?: boolean | undefined;
    } | {
        type: "template";
        template: {
            name: string;
            namespace: string;
            language: {
                code: string;
                policy?: "fallback" | "deterministic" | undefined;
            };
            components?: {
                type: "button" | "body" | "footer" | "header";
                index?: string | undefined;
                subType?: "url" | "phone_number" | "quick_reply" | "copy_code" | undefined;
                parameters?: ({
                    type: "text";
                    text: string;
                } | {
                    type: "currency";
                    currency: {
                        amount1000: number;
                        currencyCode: string;
                    };
                } | {
                    type: "date_time";
                    dateTime: {
                        timestamp?: number | undefined;
                        fallbackValue?: string | undefined;
                    };
                } | {
                    type: "image";
                    image: {
                        link: string;
                    };
                } | {
                    type: "document";
                    document: {
                        link: string;
                        filename?: string | undefined;
                    };
                } | {
                    type: "video";
                    video: {
                        link: string;
                    };
                })[] | undefined;
            }[] | undefined;
        };
        text?: string | undefined;
        previewUrl?: boolean | undefined;
    } | {
        type: "poll";
        poll: {
            options: string[];
            question: string;
            allowMultipleAnswers?: boolean | undefined;
        };
    };
    to: string;
    idempotencyKey: string;
}, {
    to: string;
    idempotencyKey: string;
    payload?: unknown;
}>;
export type SendByInstanceInput = z.infer<typeof SendByInstanceSchema>;
export interface NormalizedMessagePayload {
    type: MessagePayloadInput['type'];
    content: string;
    caption?: string;
    mediaUrl?: string;
    mediaMimeType?: string;
    mediaFileName?: string;
    previewUrl?: boolean;
    location?: LocationPayload;
    contact?: ContactPayload;
    template?: TemplatePayload;
    poll?: PollPayload;
}
export declare const normalizePayload: (input: MessagePayloadInput) => NormalizedMessagePayload;
export type SendMessageByTicketRequest = SendMessageByTicketContract;
export type SendMessageByContactRequest = SendMessageByContactContract;
export type SendMessageByInstanceRequest = SendMessageByInstanceContract;
export type OutboundMessageResponse = OutboundMessageResponseContract;
export type OutboundMessageError = OutboundMessageErrorContract;
type NormalizeExactOptional<T> = {
    [K in keyof T]-?: {} extends Pick<T, K> ? T[K] | undefined : T[K];
};
type EnsureExact<TExpected, TActual> = NormalizeExactOptional<TExpected> extends NormalizeExactOptional<TActual> ? NormalizeExactOptional<TActual> extends NormalizeExactOptional<TExpected> ? true : never : never;
export type _EnsureMessagePayload = EnsureExact<MessagePayloadContract, MessagePayloadInput>;
export type _EnsureSendByTicket = EnsureExact<SendMessageByTicketContract, SendByTicketInput>;
export type _EnsureSendByContact = EnsureExact<SendMessageByContactContract, SendByContactInput>;
export type _EnsureSendByInstance = EnsureExact<SendMessageByInstanceContract, SendByInstanceInput>;
export {};
