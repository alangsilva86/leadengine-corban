import type { Meta, StoryObj } from '@storybook/react';
type StoryConfig = {
    aiEnabled: boolean;
};
declare const MockedTab: ({ aiEnabled }: StoryConfig) => import("react/jsx-runtime").JSX.Element | null;
declare const meta: Meta<typeof MockedTab>;
export default meta;
type Story = StoryObj<typeof MockedTab>;
export declare const ComOpenAiConfigurada: Story;
export declare const SemChaveConfigurada: Story;
